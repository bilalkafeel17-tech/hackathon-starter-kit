import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod: MongoMemoryServer;
let testApp: Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());

  const { app } = await import('../../server');
  testApp = app;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('Setup API', () => {
  it('reports initialized: false initially, then true after setup', async () => {
    const statusRes1 = await request(testApp).get('/api/setup/status');
    expect(statusRes1.status).toBe(200);
    expect(statusRes1.body.data.initialized).toBe(false);

    const setupRes = await request(testApp).post('/api/setup').send({
      companyName: 'Acme Corp',
      adminName: 'Alice Admin',
      adminEmail: 'admin@acme.com',
      adminPassword: 'Password123!',
    });
    expect(setupRes.status).toBe(201);
    expect(setupRes.body.data.token).toBeDefined();
    expect(setupRes.body.data.user.role).toBe('admin');

    const statusRes2 = await request(testApp).get('/api/setup/status');
    expect(statusRes2.status).toBe(200);
    expect(statusRes2.body.data.initialized).toBe(true);
  });

  it('rejects duplicate setup with 409 SETUP_ALREADY_DONE', async () => {
    await request(testApp).post('/api/setup').send({
      companyName: 'Acme Corp',
      adminName: 'Alice Admin',
      adminEmail: 'admin@acme.com',
      adminPassword: 'Password123!',
    });

    const secondRes = await request(testApp).post('/api/setup').send({
      companyName: 'Duplicate Corp',
      adminName: 'Bob Admin',
      adminEmail: 'bob@acme.com',
      adminPassword: 'Password123!',
    });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe('SETUP_ALREADY_DONE');
  });

  it('rejects weak password on setup with 422', async () => {
    const res = await request(testApp).post('/api/setup').send({
      companyName: 'Acme Corp',
      adminName: 'Alice Admin',
      adminEmail: 'admin@acme.com',
      adminPassword: 'weak',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Authentication API', () => {
  let adminToken: string;

  beforeEach(async () => {
    const setup = await request(testApp).post('/api/setup').send({
      companyName: 'Acme Corp',
      adminName: 'Alice Admin',
      adminEmail: 'admin@acme.com',
      adminPassword: 'Password123!',
    });
    adminToken = setup.body.data.token;
  });

  it('logs in successfully with valid credentials', async () => {
    const res = await request(testApp).post('/api/auth/login').send({
      email: 'admin@acme.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@acme.com');
  });

  it('returns identical error for wrong password and unknown email', async () => {
    const wrongPassRes = await request(testApp).post('/api/auth/login').send({
      email: 'admin@acme.com',
      password: 'WrongPassword999!',
    });

    const unknownEmailRes = await request(testApp).post('/api/auth/login').send({
      email: 'nobody@acme.com',
      password: 'WrongPassword999!',
    });

    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.error.message).toBe('Invalid email or password');

    expect(unknownEmailRes.status).toBe(401);
    expect(unknownEmailRes.body.error.message).toBe('Invalid email or password');
  });

  it('rejects inactive user with generic 401 error', async () => {
    const { User } = await import('../users/user.model');
    await User.updateOne({ email: 'admin@acme.com' }, { isActive: false });

    const res = await request(testApp).post('/api/auth/login').send({
      email: 'admin@acme.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('locks out account after 5 consecutive failures with 423 ACCOUNT_LOCKED', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await request(testApp).post('/api/auth/login').send({
        email: 'admin@acme.com',
        password: 'WrongPassword999!',
      });
      expect(res.status).toBe(401);
    }

    const fifthAttempt = await request(testApp).post('/api/auth/login').send({
      email: 'admin@acme.com',
      password: 'WrongPassword999!',
    });

    expect(fifthAttempt.status).toBe(423);
    expect(fifthAttempt.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(fifthAttempt.body.error.details.remainingMinutes).toBeGreaterThan(0);
  });

  it('rejects token with old tokenVersion after password change', async () => {
    const initialToken = adminToken;

    const changeRes = await request(testApp)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${initialToken}`)
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword999!',
      });

    expect(changeRes.status).toBe(200);
    const newToken = changeRes.body.data.token;

    // Old token should now fail
    const oldRes = await request(testApp)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${initialToken}`);

    expect(oldRes.status).toBe(401);
    expect(oldRes.body.error.code).toBe('TOKEN_INVALID');

    // New token works
    const newRes = await request(testApp)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newToken}`);

    expect(newRes.status).toBe(200);
    expect(newRes.body.data.email).toBe('admin@acme.com');
  });

  it('enforces mandatory password change: blocks protected routes but allows change-password and me', async () => {
    const { User } = await import('../users/user.model');
    await User.updateOne({ email: 'admin@acme.com' }, { mustChangePassword: true });

    // /api/auth/me is allowed
    const meRes = await request(testApp)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(meRes.status).toBe(200);

    // Other protected route like /api/audit-logs is blocked with 403 PASSWORD_CHANGE_REQUIRED
    const auditRes = await request(testApp)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(403);
    expect(auditRes.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // /api/auth/change-password is permitted
    const changeRes = await request(testApp)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: 'Password123!',
        newPassword: 'BrandNewPass123!',
      });
    expect(changeRes.status).toBe(200);
  });
});

describe('Access Control and Audit Log', () => {
  it('authorize middleware returns 403 for unauthorized role', async () => {
    const { User } = await import('../users/user.model');
    const { hashPassword } = await import('../../utils/password');
    const { signToken } = await import('../../utils/jwt');

    const empUser = await User.create({
      name: 'Bob Employee',
      email: 'bob@acme.com',
      passwordHash: await hashPassword('Password123!'),
      role: 'employee',
      employeeId: new Types.ObjectId(),
      isActive: true,
      tokenVersion: 0,
    });

    const empToken = signToken({
      sub: empUser._id.toString(),
      role: empUser.role,
      tokenVersion: empUser.tokenVersion,
    });

    // Employee cannot access admin-only audit logs
    const res = await request(testApp)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${empToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('getScope returns scoped filter for employee and empty filter for hr/admin', async () => {
    const { getScope } = await import('../../middleware/auth');
    const employeeId = new Types.ObjectId();

    const empUser: any = { role: 'employee', employeeId };
    expect(getScope(empUser)).toEqual({ employeeId });

    const hrUser: any = { role: 'hr' };
    expect(getScope(hrUser)).toEqual({});

    const adminUser: any = { role: 'admin' };
    expect(getScope(adminUser)).toEqual({});

    const unlinkedEmployee: any = { role: 'employee', employeeId: null };
    expect(() => getScope(unlinkedEmployee)).toThrow();
  });

  it('AuditLog model blocks updates and deletions (append-only)', async () => {
    const { AuditLog } = await import('./../audit/audit.model');

    const log = await AuditLog.create({
      actorName: 'Alice',
      actorRole: 'admin',
      action: 'SETUP_COMPLETED',
      entity: 'Company',
      ip: '127.0.0.1',
      userAgent: 'TestAgent',
    });

    // Mutating save throws
    log.action = 'MODIFIED_ACTION';
    await expect(log.save()).rejects.toThrow();

    // Query update throws
    await expect(
      AuditLog.updateOne({ _id: log._id }, { action: 'HACKED' })
    ).rejects.toThrow();

    // Query delete throws
    await expect(AuditLog.deleteOne({ _id: log._id })).rejects.toThrow();
  });
});
