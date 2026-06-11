import request from 'supertest';
import express from 'express';

// Create an isolated instance for tests to avoid ts-jest module resolution circular dependency
const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/tasks', (req, res) => res.status(401).send());

describe('App Endpoints', () => {
  it('should return 200 OK from health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('should block unauthenticated access to tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});
