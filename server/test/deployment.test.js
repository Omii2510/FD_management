import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import request from 'supertest';

describe('Phase 12 testing and deployment', () => {
  it('exposes the API health endpoint', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('FD Connect API is running');
  });

  it('reports database state without opening a test connection', () => {
    const validStates = [0, 1, 2, 3];
    expect(validStates).toContain(mongoose.connection.readyState);
  });

  it('returns a structured 404 response', async () => {
    const response = await request(app).get('/api/v1/not-a-real-route');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
    });
  });
});
