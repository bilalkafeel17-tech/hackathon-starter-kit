import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
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

describe('GET /api/health', () => {
  it('returns 200 with public status and time only', async () => {
    const res = await request(testApp).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.time).toBeDefined();
    // Verify internal diagnostic details are NOT exposed publicly
    expect(res.body.data.uptime).toBeUndefined();
    expect(res.body.data.memory).toBeUndefined();
    expect(res.body.data.database).toBeUndefined();
    expect(res.body.data.nodeVersion).toBeUndefined();
  });

  it('returns 404 with standard error shape for unknown routes', async () => {
    const res = await request(testApp).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
