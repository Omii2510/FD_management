import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import {
  createRandomToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { sendAuthEmail } from '../services/email.service.js';

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', cookieOptions(0));
  res.clearCookie('refreshToken', cookieOptions(0));
};

const publicUser = (user) => {
  const data = user.toJSON();
  return data;
};

export const register = async (req, res, next) => {
  try {
    const parsed = req.validatedBody;
    const existing = await User.findOne({ email: parsed.email });
    if (existing) throw createError('An account with this email already exists.', 409);

    const emailToken = createRandomToken();
    const user = await User.create({
      fullName: parsed.fullName,
      email: parsed.email,
      phone: parsed.phone,
      passwordHash: parsed.password,
      authProvider: 'local',
      role: 'user',
      emailVerificationTokenHash: hashToken(emailToken),
      emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    await sendAuthEmail({
      to: user.email,
      subject: 'Verify your FD Connect email',
      text: `Verify your email: ${clientUrl}/verify-email/${emailToken}`,
      html: `<p>Verify your email: <a href="${clientUrl}/verify-email/${emailToken}">Verify email</a></p>`,
    }).catch(() => undefined);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Verify your email before signing in.',
      data: { user: publicUser(user), emailVerificationToken: process.env.NODE_ENV === 'development' ? emailToken : undefined },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      error.statusCode = 400;
      error.details = error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const parsed = req.validatedBody;
    const user = await User.findOne({ email: parsed.email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(parsed.password))) {
      throw createError('Invalid email or password.', 401);
    }
    if (!user.isActive) throw createError('Your account is inactive.', 403);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshTokenHash = hashToken(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, message: 'Login successful.', data: { user: publicUser(user), accessToken } });
  } catch (error) {
    if (error.name === 'ZodError') {
      error.statusCode = 400;
      error.details = error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    }
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) throw createError('Google ID token is required.', 400);
    if (!process.env.GOOGLE_CLIENT_ID) throw createError('Google authentication is not configured.', 503);

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw createError('Google account email could not be verified.', 401);
    }

    let user = await User.findOne({ email: payload.email.toLowerCase() });
    if (user && user.isActive) {
      if (user.role !== 'user') {
        throw createError('Google sign-in is available for customer accounts only.', 403);
      }
      if (!user.googleId) {
        user.googleId = payload.sub;
        user.authProvider = 'google';
      }
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    } else if (!user) {
      user = await User.create({
        fullName: payload.name || payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        authProvider: 'google',
        role: 'user',
        profileImage: payload.picture,
        emailVerifiedAt: new Date(),
      });
    } else {
      throw createError('Your account is inactive.', 403);
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshTokenHash = hashToken(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, message: 'Google login successful.', data: { user: publicUser(user), accessToken } });
  } catch (error) {
    if (error.message?.includes('Invalid token') || error.message?.includes('Wrong recipient')) {
      error.statusCode = 401;
    }
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) throw createError('Refresh session is missing.', 401);

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub).select('+refreshTokenHash +refreshTokenExpires');
    if (!user || !user.isActive) throw createError('Session is unavailable.', 401);
    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
      throw createError('Refresh session is invalid.', 401);
    }
    if (!user.refreshTokenExpires || user.refreshTokenExpires <= new Date()) {
      throw createError('Refresh session has expired.', 401);
    }

    const nextRefreshToken = signRefreshToken(user);
    const accessToken = signAccessToken(user);
    user.refreshTokenHash = hashToken(nextRefreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    setAuthCookies(res, accessToken, nextRefreshToken);
    res.json({ success: true, message: 'Session refreshed.', data: { accessToken } });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error.statusCode = 401;
      error.message = 'Invalid or expired refresh session.';
    }
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.refreshTokenHash = null;
      req.user.refreshTokenExpires = null;
      await req.user.save();
    }
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordResetTokenHash');
  if (user) {
    const token = createRandomToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    await sendAuthEmail({
      to: user.email,
      subject: 'Reset your FD Connect password',
      text: `Reset your password: ${clientUrl}/reset-password/${token}`,
      html: `<p>Reset your password: <a href="${clientUrl}/reset-password/${token}">Reset password</a></p>`,
    }).catch(() => undefined);
  }
  res.json({
    success: true,
    message: 'If an account exists for that email, password reset instructions have been sent.',
  });
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== 'string' || password.length < 8 || password.length > 72) {
      throw createError('A valid reset token and new password are required.', 400);
    }
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash');
    if (!user) throw createError('Reset token is invalid or expired.', 400);

    user.passwordHash = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.refreshTokenHash = null;
    user.refreshTokenExpires = null;
    await user.save();
    clearAuthCookies(res);
    res.json({ success: true, message: 'Password reset successful.' });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationTokenHash');
    if (!user) throw createError('Email verification token is invalid or expired.', 400);

    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};

export const me = (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user) } });
};
