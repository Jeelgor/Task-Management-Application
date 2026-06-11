import request from 'supertest';
import app from '../index';

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
