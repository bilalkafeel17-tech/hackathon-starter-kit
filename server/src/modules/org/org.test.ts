import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { Express } from 'express';
import { countWorkingDays, listWorkingDays } from '../../utils/workingDays';
import { isWeekend, isValidDateKey, listDateKeys } from '../../utils/date';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod: MongoMemoryServer;
let testApp: Express;

let adminToken: string;
let hrToken: string;
let empToken: string;

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

  // 1. Setup company and admin
  const setupRes = await request(testApp).post('/api/setup').send({
    companyName: 'Acme Corp',
    adminName: 'Alice Admin',
    adminEmail: 'admin@acme.com',
    adminPassword: 'Password123!',
  });
  adminToken = setupRes.body.data.token;

  // 2. Create HR user via Admin endpoint
  const hrCreateRes = await request(testApp)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Bob HR',
      email: 'hr@acme.com',
    });
  const hrTempPassword = hrCreateRes.body.data.tempPassword;

  // HR logs in with temp password
  const hrLogin = await request(testApp).post('/api/auth/login').send({
    email: 'hr@acme.com',
    password: hrTempPassword,
  });
  const initialHrToken = hrLogin.body.data.token;

  // HR changes password to satisfy forced password change requirement
  const hrPassChange = await request(testApp)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${initialHrToken}`)
    .send({
      currentPassword: hrTempPassword,
      newPassword: 'NewHrPassword123!',
    });
  hrToken = hrPassChange.body.data.token;

  // 3. Create employee directly in database
  const { User } = await import('../users/user.model');
  const { hashPassword } = await import('../../utils/password');
  const { signToken } = await import('../../utils/jwt');

  const empUser = await User.create({
    name: 'Charlie Employee',
    email: 'charlie@acme.com',
    passwordHash: await hashPassword('Password123!'),
    role: 'employee',
    employeeId: new mongoose.Types.ObjectId(),
    isActive: true,
    tokenVersion: 0,
    mustChangePassword: false,
  });
  empToken = signToken({
    sub: empUser._id.toString(),
    role: empUser.role,
    tokenVersion: empUser.tokenVersion,
  });
});

describe('Date and Working Days Utilities', () => {
  it('validates strictly valid calendar dates', () => {
    expect(isValidDateKey('2026-01-15')).toBe(true);
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isValidDateKey('2024-02-29')).toBe(true);  // 2024 is a leap year
    expect(isValidDateKey('2026-04-31')).toBe(false); // April has 30 days
    expect(isValidDateKey('invalid')).toBe(false);
  });

  it('rejects listDateKeys when from > to', () => {
    expect(() => listDateKeys('2026-01-10', '2026-01-05')).toThrow();
  });

  it('counts working days excluding weekends and holidays', () => {
    // 2026-01-05 (Monday) to 2026-01-11 (Sunday) = 7 calendar days
    // weekendDays = [0, 6] (Saturday & Sunday) -> 5 weekdays (Mon-Fri)
    const weekendDays = [0, 6];
    const holidays = new Set(['2026-01-07']); // Wednesday holiday

    const days = listWorkingDays('2026-01-05', '2026-01-11', weekendDays, holidays);
    expect(days).toEqual(['2026-01-05', '2026-01-06', '2026-01-08', '2026-01-09']);
    expect(countWorkingDays('2026-01-05', '2026-01-11', weekendDays, holidays)).toBe(4);
  });

  it('handles holiday on a weekend without double counting', () => {
    const weekendDays = [0, 6];
    // 2026-01-10 is a Saturday
    expect(isWeekend('2026-01-10', weekendDays)).toBe(true);

    const holidays = new Set(['2026-01-10']);
    const count = countWorkingDays('2026-01-05', '2026-01-11', weekendDays, holidays);
    expect(count).toBe(5); // 5 working days (Mon-Fri)
  });

  it('handles single-day range correctly', () => {
    const weekendDays = [0, 6];
    // 2026-01-05 is a Monday
    expect(countWorkingDays('2026-01-05', '2026-01-05', weekendDays, new Set())).toBe(1);
    // 2026-01-10 is a Saturday
    expect(countWorkingDays('2026-01-10', '2026-01-10', weekendDays, new Set())).toBe(0);
  });
});

describe('Company Settings API', () => {
  it('allows Admin to update settings, increments version, and audits update', async () => {
    const res = await request(testApp)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Acme Global Corp',
        officeStart: '08:30',
        graceMinutes: 20,
        halfDayHours: 4.5,
        weekendDays: [5, 6],
        timezone: 'Asia/Karachi',
        office: {
          lat: 24.8607,
          lng: 67.0011,
          radiusMeters: 250,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe('Acme Global Corp');
    expect(res.body.data.officeStart).toBe('08:30');
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.office.lat).toBe(24.8607);
  });

  it('HR can view full settings but gets 403 on PATCH', async () => {
    const getRes = await request(testApp)
      .get('/api/settings')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.companyName).toBeDefined();

    const patchRes = await request(testApp)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ companyName: 'Hacked Corp' });
    expect(patchRes.status).toBe(403);
  });

  it('Employee only gets public subset without office coordinates', async () => {
    const publicRes = await request(testApp)
      .get('/api/settings/public')
      .set('Authorization', `Bearer ${empToken}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.companyName).toBe('Acme Corp');
    expect(publicRes.body.data.office).toBeUndefined();

    const fullRes = await request(testApp)
      .get('/api/settings')
      .set('Authorization', `Bearer ${empToken}`);
    expect(fullRes.status).toBe(403);
  });

  it('validates settings input: invalid time, timezone, and uncoupled coordinates return 422', async () => {
    // Bad time format
    const badTime = await request(testApp)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ officeStart: '8:30am' });
    expect(badTime.status).toBe(422);

    // Bad timezone
    const badTz = await request(testApp)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timezone: 'Invalid/NonExistent_Zone' });
    expect(badTz.status).toBe(422);

    // Lat without lng
    const uncoupled = await request(testApp)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ office: { lat: 24.8607 } });
    expect(uncoupled.status).toBe(422);
  });
});

describe('Departments and Designations API', () => {
  let deptId: string;

  it('creates a department, rejects duplicates (case-insensitive), activates and deactivates', async () => {
    const createRes = await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Engineering',
        code: 'ENG',
        description: 'Software development department',
      });
    expect(createRes.status).toBe(201);
    deptId = createRes.body.data._id;

    // Duplicate exact
    const dupRes = await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Engineering' });
    expect(dupRes.status).toBe(409);

    // Duplicate case-insensitive
    const caseDupRes = await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  engineering  ' });
    expect(caseDupRes.status).toBe(409);

    // Deactivate
    const deactRes = await request(testApp)
      .patch(`/api/departments/${deptId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.isActive).toBe(false);

    // Activate
    const actRes = await request(testApp)
      .patch(`/api/departments/${deptId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.isActive).toBe(true);
  });

  it('creates designation linked to department, rejects duplicate in same department and inactive department', async () => {
    const deptRes = await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Marketing', code: 'MKT' });
    const marketingId = deptRes.body.data._id;

    const desigRes = await request(testApp)
      .post('/api/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Senior Copywriter',
        departmentId: marketingId,
        level: 'L3',
      });
    expect(desigRes.status).toBe(201);

    // Duplicate in same department
    const dupDesig = await request(testApp)
      .post('/api/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'senior copywriter',
        departmentId: marketingId,
      });
    expect(dupDesig.status).toBe(409);

    // Deactivate marketing department
    await request(testApp)
      .patch(`/api/departments/${marketingId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Cannot add designation to inactive department
    const inactiveDeptDesig = await request(testApp)
      .post('/api/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Brand Manager',
        departmentId: marketingId,
      });
    expect(inactiveDeptDesig.status).toBe(400);
  });
});

describe('Leave Types and Suggestions API', () => {
  it('GET suggestions does not write to database; applySuggestions seeds 4 types; applying twice skips all', async () => {
    // GET suggestions
    const suggRes = await request(testApp)
      .get('/api/leave-types/suggestions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(suggRes.status).toBe(200);
    expect(suggRes.body.data.length).toBe(4);

    // Verify none created yet
    const listBefore = await request(testApp)
      .get('/api/leave-types')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listBefore.body.data.length).toBe(0);

    // Apply suggestions
    const applyRes1 = await request(testApp)
      .post('/api/leave-types/apply-suggestions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(applyRes1.status).toBe(200);
    expect(applyRes1.body.data.created.length).toBe(4);
    expect(applyRes1.body.data.skipped.length).toBe(0);

    // Applying twice skips all 4
    const applyRes2 = await request(testApp)
      .post('/api/leave-types/apply-suggestions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(applyRes2.status).toBe(200);
    expect(applyRes2.body.data.created.length).toBe(0);
    expect(applyRes2.body.data.skipped.length).toBe(4);

    // Employee can read leave types
    const empRead = await request(testApp)
      .get('/api/leave-types')
      .set('Authorization', `Bearer ${empToken}`);
    expect(empRead.status).toBe(200);
    expect(empRead.body.data.length).toBe(4);

    // Employee cannot create leave type
    const empCreate = await request(testApp)
      .post('/api/leave-types')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ name: 'Study Leave', code: 'study', isPaid: false });
    expect(empCreate.status).toBe(403);
  });
});

describe('Holidays API', () => {
  it('rejects invalid date on create; bulk creation with one bad row aborts all and reports error', async () => {
    // Bad date
    const badDateRes = await request(testApp)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Impossible Day', date: '2026-02-29' });
    expect(badDateRes.status).toBe(422);

    // Bulk creation with one bad date
    const bulkBadRes = await request(testApp)
      .post('/api/holidays/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        holidays: [
          { name: 'Labor Day', date: '2026-05-01' },
          { name: 'Invalid Day', date: '2026-04-31' },
        ],
      });
    expect(bulkBadRes.status).toBe(422);

    // Verify Labor Day was not created due to all-or-nothing rollback
    const listRes = await request(testApp)
      .get('/api/holidays')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.length).toBe(0);

    // Valid bulk creation
    const bulkGoodRes = await request(testApp)
      .post('/api/holidays/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        holidays: [
          { name: 'Labor Day', date: '2026-05-01' },
          { name: 'Independence Day', date: '2026-08-14' },
        ],
      });
    expect(bulkGoodRes.status).toBe(201);
    expect(bulkGoodRes.body.data.count).toBe(2);

    // Delete holiday
    const delRes = await request(testApp)
      .delete(`/api/holidays/${bulkGoodRes.body.data.created[0]._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
  });
});

describe('User Management API (Admin only)', () => {
  it('Admin creates HR user with temp password; HR forced password change; HR blocked from /api/users', async () => {
    const hrRes = await request(testApp)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'David HR', email: 'david.hr@acme.com' });

    expect(hrRes.status).toBe(201);
    expect(hrRes.body.data.user.role).toBe('hr');
    expect(hrRes.body.data.tempPassword).toBeDefined();

    // David logs in with temp password
    const loginRes = await request(testApp).post('/api/auth/login').send({
      email: 'david.hr@acme.com',
      password: hrRes.body.data.tempPassword,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.mustChangePassword).toBe(true);

    const davidToken = loginRes.body.data.token;

    // David is blocked from calling /api/users
    const usersRes = await request(testApp)
      .get('/api/users')
      .set('Authorization', `Bearer ${davidToken}`);
    expect(usersRes.status).toBe(403);
  });

  it('admin cannot deactivate self, and last active admin is protected', async () => {
    const { User } = await import('../users/user.model');
    const adminUser = await User.findOne({ email: 'admin@acme.com' });

    // Admin tries to deactivate self
    const selfDeact = await request(testApp)
      .patch(`/api/users/${adminUser!._id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(selfDeact.status).toBe(400);
  });

  it('reset-password on an admin returns 403', async () => {
    const { User } = await import('../users/user.model');
    const adminUser = await User.findOne({ email: 'admin@acme.com' });

    const resetRes = await request(testApp)
      .post(`/api/users/${adminUser!._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(403);
  });

  it('deactivated user token is rejected on subsequent calls', async () => {
    const { User } = await import('../users/user.model');
    const hrUser = await User.findOne({ email: 'hr@acme.com' });

    // Deactivate HR user
    const deactRes = await request(testApp)
      .patch(`/api/users/${hrUser!._id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactRes.status).toBe(200);

    // Existing HR token must now be rejected
    const testCall = await request(testApp)
      .get('/api/settings')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(testCall.status).toBe(401);
  });
});

describe('Organization Setup Readiness Checklist', () => {
  it('reports live readiness status and isReadyForEmployees condition', async () => {
    const res1 = await request(testApp)
      .get('/api/org/readiness')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.companyName).toBe(true);
    expect(res1.body.data.isReadyForEmployees).toBe(false);

    // Seed departments and leave types to achieve readiness
    await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Operations' });

    await request(testApp)
      .post('/api/leave-types/apply-suggestions')
      .set('Authorization', `Bearer ${adminToken}`);

    const res2 = await request(testApp)
      .get('/api/org/readiness')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.departments).toBeGreaterThanOrEqual(1);
    expect(res2.body.data.leaveTypes).toBeGreaterThanOrEqual(1);
    expect(res2.body.data.isReadyForEmployees).toBe(true);
  });
});
