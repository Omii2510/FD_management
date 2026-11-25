import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const developmentSecrets = {};

const getJwtSecret = (envName, secretKey) => {
  if (process.env[envName]) return process.env[envName];
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(`${envName} must be configured outside development.`);
  }
  if (!developmentSecrets[secretKey]) {
    developmentSecrets[secretKey] = crypto.randomBytes(32).toString('hex');
  }
  return developmentSecrets[secretKey];
};

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createRandomToken = () =>
  crypto.randomBytes(32).toString('hex');

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, bankId: user.bankId?.toString() || null },
    getJwtSecret('JWT_ACCESS_SECRET', 'access'),
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );

export const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), type: 'refresh' },
    getJwtSecret('JWT_REFRESH_SECRET', 'refresh'),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, getJwtSecret('JWT_ACCESS_SECRET', 'access'));

export const verifyRefreshToken = (token) =>
  jwt.verify(token, getJwtSecret('JWT_REFRESH_SECRET', 'refresh'));
