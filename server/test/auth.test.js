import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../src/utils/tokens.js';
import { registerSchema } from '../src/validators/auth.validators.js';
import { googleLogin } from '../src/controllers/auth.controller.js';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
});

describe('Phase 3 authentication foundation', () => {
  it('rejects invalid registration input', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ fullName: 'A', email: 'invalid', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('protects current-user endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('does not allow Google sign-in to access privileged accounts', async () => {
    const findUser = vi.spyOn(User, 'findOne').mockResolvedValue({
      role: 'admin',
      isActive: true,
    });
    const verifyToken = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        email: 'admin@example.test',
        email_verified: true,
        sub: 'google-subject',
      }),
    });
    let forwardedError;

    try {
      await googleLogin(
        { body: { idToken: 'valid-google-token' } },
        {},
        (error) => { forwardedError = error; }
      );
      expect(forwardedError.statusCode).toBe(403);
    } finally {
      findUser.mockRestore();
      verifyToken.mockRestore();
    }
  });

  it('signs and verifies a short-lived access token', () => {
    const user = new User({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'user',
      authProvider: 'local',
    });
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(user._id.toString());
    expect(payload.role).toBe('user');
  });

  it('uses process-local signing secrets when development secrets are not configured', () => {
    const originalEnvironment = {
      nodeEnv: process.env.NODE_ENV,
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    };
    const user = new User({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'user',
      authProvider: 'local',
    });

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      expect(verifyAccessToken(signAccessToken(user)).sub).toBe(user._id.toString());
      expect(verifyRefreshToken(signRefreshToken(user)).sub).toBe(user._id.toString());
    } finally {
      if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnvironment.nodeEnv;
      if (originalEnvironment.accessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = originalEnvironment.accessSecret;
      if (originalEnvironment.refreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
      else process.env.JWT_REFRESH_SECRET = originalEnvironment.refreshSecret;
    }
  });

  it('hashes password and reset/session tokens without exposing the password', () => {
    const user = new User({
      fullName: 'Test User',
      email: 'test2@example.com',
      passwordHash: 'not-a-real-password',
      role: 'user',
      authProvider: 'local',
    });
    expect(user.passwordHash).toBeDefined();
    expect(user.toJSON().passwordHash).toBeUndefined();
    expect(hashToken('reset-token')).toHaveLength(64);
  });

  it('creates a public registration schema with no privileged role field', async () => {
    const parsed = registerSchema.parse({
      fullName: 'Valid User',
      email: 'valid@example.test',
      password: 'password123',
      role: 'admin',
    });
    expect(parsed.role).toBeUndefined();
  });
});
