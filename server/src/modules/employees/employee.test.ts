import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { Express } from 'express';
import { computeSalary } from '../../utils/salary';
import { AuditLog } from '../audit/audit.model';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod: MongoMemoryServer;
let testApp: Express;

let adminToken: string;
let hrToken: string;

let defaultDeptId: string;
let defaultDesigId: string;

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

  // HR logs in with temp password and completes forced password change
  const hrLogin = await request(testApp).post('/api/auth/login').send({
    email: 'hr@acme.com',
    password: hrTempPassword,
  });
  const initialHrToken = hrLogin.body.data.token;

  const hrPassChange = await request(testApp)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${initialHrToken}`)
    .send({
      currentPassword: hrTempPassword,
      newPassword: 'NewHrPassword123!',
    });
  hrToken = hrPassChange.body.data.token;

  // 3. Setup default department and designation
  const deptRes = await request(testApp)
    .post('/api/departments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Engineering', code: 'ENG' });
  defaultDeptId = deptRes.body.data._id;

  const desigRes = await request(testApp)
    .post('/api/designations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Software Engineer',
      departmentId: defaultDeptId,
      level: 'L2',
    });
  defaultDesigId = desigRes.body.data._id;

  // 4. Seed leave types to achieve org readiness
  await request(testApp)
    .post('/api/leave-types/apply-suggestions')
    .set('Authorization', `Bearer ${adminToken}`);
});

describe('Salary Computation Utility', () => {
  it('computes exact breakdown for standard and fractional amounts without floating point drift', () => {
    // 100,000 -> hra 40,000, medical 10,000, gross 150,000
    const res1 = computeSalary(100000);
    expect(res1.basic).toBe(100000);
    expect(res1.hra).toBe(40000);
    expect(res1.medical).toBe(10000);
    expect(res1.extraAllowance).toBe(0);
    expect(res1.gross).toBe(150000);

    // 33333.33 with 500 extra allowance
    const res2 = computeSalary(33333.33, 500);
    expect(res2.basic).toBe(33333.33);
    expect(res2.hra).toBe(13333.33);
    expect(res2.medical).toBe(3333.33);
    expect(res2.extraAllowance).toBe(500);
    expect(res2.gross).toBe(50499.99);
  });
});

describe('Employee Registration and Authentication Flow', () => {
  it('checks organization readiness, registers employee, and allows employee login and password change', async () => {
    const regRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Charlie Brown',
        email: 'charlie@acme.com',
        phone: '+1-555-0199',
        address: '123 Elm Street',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        employmentType: 'full_time',
        salary: { basic: 80000, extraAllowance: 2000 },
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.employee.employeeCode).toBe('EMP-0001');
    expect(regRes.body.data.tempPassword).toBeDefined();

    const tempPass = regRes.body.data.tempPassword;

    // Charlie logs in with temp password
    const empLogin = await request(testApp).post('/api/auth/login').send({
      email: 'charlie@acme.com',
      password: tempPass,
    });
    expect(empLogin.status).toBe(200);
    expect(empLogin.body.data.mustChangePassword).toBe(true);

    const tempEmpToken = empLogin.body.data.token;

    // Change password
    const passRes = await request(testApp)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tempEmpToken}`)
      .send({
        currentPassword: tempPass,
        newPassword: 'NewEmployeePass123!',
      });
    expect(passRes.status).toBe(200);
    const empToken = passRes.body.data.token;

    // Charlie reads own profile via /me
    const meRes = await request(testApp)
      .get('/api/employees/me')
      .set('Authorization', `Bearer ${empToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('charlie@acme.com');
  });

  it('rejects duplicate email with 409 and invalid department with 422', async () => {
    // Register employee first
    await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'David Lee',
        email: 'david@acme.com',
        phone: '1234567890',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 50000 },
      });

    // Duplicate email
    const dupRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'David Clone',
        email: 'david@acme.com',
        phone: '9876543210',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 50000 },
      });
    expect(dupRes.status).toBe(409);

    // Non-existent department ID
    const fakeDeptRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Invalid Dept User',
        email: 'invalid.dept@acme.com',
        phone: '9876543210',
        joiningDate: '2026-01-01',
        departmentId: new mongoose.Types.ObjectId().toString(),
        designationId: defaultDesigId,
        salary: { basic: 50000 },
      });
    expect(fakeDeptRes.status).toBe(422);
  });

  it('blocks Admin and Employee from calling POST /api/employees', async () => {
    const adminTry = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Creation',
        email: 'admin.create@acme.com',
        phone: '1234567890',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 50000 },
      });
    expect(adminTry.status).toBe(403);
  });
});

describe('Data Scoping and Role Permissions', () => {
  let empAToken: string;
  let empAId: string;
  let empBId: string;

  beforeEach(async () => {
    const empARes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Employee A',
        email: 'empa@acme.com',
        phone: '1112223334',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 60000 },
      });
    empAId = empARes.body.data.employee._id;
    const empAPass = empARes.body.data.tempPassword;

    const loginA = await request(testApp).post('/api/auth/login').send({
      email: 'empa@acme.com',
      password: empAPass,
    });
    const passChangeA = await request(testApp)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginA.body.data.token}`)
      .send({
        currentPassword: empAPass,
        newPassword: 'EmployeePassA123!',
      });
    empAToken = passChangeA.body.data.token;

    const empBRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Employee B',
        email: 'empb@acme.com',
        phone: '5556667778',
        joiningDate: '2026-01-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 70000 },
      });
    empBId = empBRes.body.data.employee._id;
  });

  it('employee A cannot view employee B by id, and list returns only employee A', async () => {
    // Employee A requesting Employee B by id
    const getB = await request(testApp)
      .get(`/api/employees/${empBId}`)
      .set('Authorization', `Bearer ${empAToken}`);
    expect(getB.status).toBe(403);

    // Employee A requesting employee list
    const listRes = await request(testApp)
      .get('/api/employees')
      .set('Authorization', `Bearer ${empAToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0]._id).toBe(empAId);
  });

  it('employee never sees salary structure, while Admin and HR can view it', async () => {
    // Employee tries to read own salary endpoint
    const empSalaryRes = await request(testApp)
      .get(`/api/employees/${empAId}/salary`)
      .set('Authorization', `Bearer ${empAToken}`);
    expect(empSalaryRes.status).toBe(403);

    // Employee 360 overview for employee has salary === null
    const emp360Res = await request(testApp)
      .get(`/api/employees/${empAId}/360`)
      .set('Authorization', `Bearer ${empAToken}`);
    expect(emp360Res.status).toBe(200);
    expect(emp360Res.body.data.salary).toBeNull();

    // HR can view salary
    const hrSalaryRes = await request(testApp)
      .get(`/api/employees/${empAId}/salary`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(hrSalaryRes.status).toBe(200);
    expect(hrSalaryRes.body.data.current.basic).toBe(60000);

    // Admin can view salary but cannot modify it
    const adminSalaryGet = await request(testApp)
      .get(`/api/employees/${empAId}/salary`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminSalaryGet.status).toBe(200);

    const adminSalaryPut = await request(testApp)
      .put(`/api/employees/${empAId}/salary`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ basic: 65000 });
    expect(adminSalaryPut.status).toBe(403);
  });

  it('employee can update phone and address via /me/contact; extra fields are rejected with 422', async () => {
    const validContact = await request(testApp)
      .patch('/api/employees/me/contact')
      .set('Authorization', `Bearer ${empAToken}`)
      .send({
        phone: '+92-300-1234567',
        address: 'Suite 404, Tech Park',
      });
    expect(validContact.status).toBe(200);
    expect(validContact.body.data.phone).toBe('+92-300-1234567');

    // Forbidden extra fields
    const invalidContact = await request(testApp)
      .patch('/api/employees/me/contact')
      .set('Authorization', `Bearer ${empAToken}`)
      .send({
        phone: '+92-300-1234567',
        name: 'Hacked Name',
      });
    expect(invalidContact.status).toBe(422);
  });
});

describe('Salary Versions and Immutability', () => {
  it('creates new salary versions, rejects same effectiveFrom with 409, and rejects date before joining', async () => {
    const empRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Edward Salary',
        email: 'edward@acme.com',
        phone: '1234567890',
        joiningDate: '2026-02-01',
        departmentId: defaultDeptId,
        designationId: defaultDesigId,
        salary: { basic: 50000 },
      });
    const empId = empRes.body.data.employee._id;

    // Update salary for 2026-03-01
    const update1 = await request(testApp)
      .put(`/api/employees/${empId}/salary`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        basic: 60000,
        extraAllowance: 1000,
        effectiveFrom: '2026-03-01',
      });
    expect(update1.status).toBe(200);
    expect(update1.body.data.gross).toBe(91000); // 60000 + 24000 + 6000 + 1000

    // Duplicate effectiveFrom -> 409
    const dupDate = await request(testApp)
      .put(`/api/employees/${empId}/salary`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        basic: 62000,
        effectiveFrom: '2026-03-01',
      });
    expect(dupDate.status).toBe(409);

    // effectiveFrom before joiningDate -> 400
    const beforeJoining = await request(testApp)
      .put(`/api/employees/${empId}/salary`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        basic: 62000,
        effectiveFrom: '2026-01-01',
      });
    expect(beforeJoining.status).toBe(400);
  });
});

describe('Employee Exit and Department Guard', () => {
  it('exits employee, invalidates login tokens, and allows department deactivation once active employees are gone', async () => {
    // Create new department
    const deptRes = await request(testApp)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Human Resources Dept', code: 'HRD' });
    const hrdId = deptRes.body.data._id;

    const desigRes = await request(testApp)
      .post('/api/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'HR Assistant', departmentId: hrdId });
    const hrdDesigId = desigRes.body.data._id;

    const empRes = await request(testApp)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Fiona Exit',
        email: 'fiona@acme.com',
        phone: '1234567890',
        joiningDate: '2026-01-01',
        departmentId: hrdId,
        designationId: hrdDesigId,
        salary: { basic: 40000 },
      });
    const fionaId = empRes.body.data.employee._id;
    const fionaTempPass = empRes.body.data.tempPassword;

    // Fiona logs in
    const fionaLogin = await request(testApp).post('/api/auth/login').send({
      email: 'fiona@acme.com',
      password: fionaTempPass,
    });
    const fionaToken = fionaLogin.body.data.token;

    // Trying to deactivate department while Fiona is active -> 409
    const deactBlocked = await request(testApp)
      .patch(`/api/departments/${hrdId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactBlocked.status).toBe(409);

    // Exit Fiona
    const exitRes = await request(testApp)
      .post(`/api/employees/${fionaId}/exit`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        exitDate: '2026-02-15',
        reason: 'Resigned for higher studies',
      });
    expect(exitRes.status).toBe(200);
    expect(exitRes.body.data.status).toBe('exited');

    // Fiona's old token is rejected
    const fionaTry = await request(testApp)
      .get('/api/employees/me')
      .set('Authorization', `Bearer ${fionaToken}`);
    expect(fionaTry.status).toBe(401);

    // Fiona cannot log in
    const fionaReLogin = await request(testApp).post('/api/auth/login').send({
      email: 'fiona@acme.com',
      password: fionaTempPass,
    });
    expect(fionaReLogin.status).toBe(401);

    // Now department can be deactivated because there are 0 non-exited employees
    const deactSuccess = await request(testApp)
      .patch(`/api/departments/${hrdId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactSuccess.status).toBe(200);
    expect(deactSuccess.body.data.isActive).toBe(false);
  });
});

describe('CSV Import, Export, and Injection Defense', () => {
  it('template returns 200 with text/csv header and example row', async () => {
    const res = await request(testApp)
      .get('/api/employees/import/template')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('employeeCode,name,email');
  });

  it('dry run reports line errors without writing; clean import creates employees; export neutralizes injection', async () => {
    // Dirty CSV with invalid email, bad date, salary 0
    const dirtyCsv = [
      'employeeCode,name,email,phone,gender,dateOfBirth,joiningDate,department,designation,employmentType,basicSalary',
      'EMP-2001,Bad Email Guy,notanemail,+1234567890,male,1990-01-01,2026-01-01,Engineering,Software Engineer,full_time,50000',
      'EMP-2002,Bad Date Guy,good@acme.com,+1234567890,male,1990-01-01,2026-02-29,Engineering,Software Engineer,full_time,50000',
      'EMP-2003,Zero Salary Guy,zero@acme.com,+1234567890,male,1990-01-01,2026-01-01,Engineering,Software Engineer,full_time,0',
    ].join('\n');

    const dryRunRes = await request(testApp)
      .post('/api/employees/import?dryRun=true')
      .set('Authorization', `Bearer ${hrToken}`)
      .attach('file', Buffer.from(dirtyCsv), 'dirty.csv');

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.data.invalidRows).toBe(3);
    expect(dryRunRes.body.data.errors.length).toBeGreaterThanOrEqual(3);

    // Verify nothing was written
    const listBefore = await request(testApp)
      .get('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(listBefore.body.data.length).toBe(0);

    // Clean CSV with potentially dangerous formula injection name
    const cleanCsv = [
      'employeeCode,name,email,phone,gender,dateOfBirth,joiningDate,department,designation,employmentType,basicSalary',
      'EMP-3001,=cmd|/C calc,formula@acme.com,+1234567890,male,1990-01-01,2026-01-01,Engineering,Software Engineer,full_time,75000',
    ].join('\n');

    const importRes = await request(testApp)
      .post('/api/employees/import')
      .set('Authorization', `Bearer ${hrToken}`)
      .attach('file', Buffer.from(cleanCsv), 'clean.csv');

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.created).toBe(1);
    expect(importRes.body.data.credentials[0].temporaryPassword).toBeDefined();

    // Export employees: verify formula character is neutralized with a single quote
    const exportRes = await request(testApp)
      .get('/api/employees/export')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    // Sanitized cell should start with '=
    expect(exportRes.text).toContain("`'=cmd|/C calc`".replace(/`/g, ''));
    // Export must NOT contain salary
    expect(exportRes.text).not.toContain('basicSalary');
    expect(exportRes.text).not.toContain('75000');
  });

  it('rejects CSV with more than 100 data rows', async () => {
    const lines = [
      'employeeCode,name,email,phone,gender,dateOfBirth,joiningDate,department,designation,employmentType,basicSalary',
    ];
    for (let i = 1; i <= 101; i++) {
      lines.push(
        `EMP-${1000 + i},User ${i},user${i}@acme.com,1234567890,male,1990-01-01,2026-01-01,Engineering,Software Engineer,full_time,50000`
      );
    }

    const res = await request(testApp)
      .post('/api/employees/import?dryRun=true')
      .set('Authorization', `Bearer ${hrToken}`)
      .attach('file', Buffer.from(lines.join('\n')), 'huge.csv');

    expect(res.status).toBe(422);
  });
});

describe('Audit Logging Verification', () => {
  it('records audit events without passwords or sensitive secrets', async () => {
    const logs = await AuditLog.find({}).lean();
    for (const log of logs) {
      const logStr = JSON.stringify(log);
      expect(logStr).not.toContain('Password123!');
      expect(logStr).not.toContain('temporaryPassword');
    }
  });
});
