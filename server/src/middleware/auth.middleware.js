import { createError } from './errorHandler.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { Bank, User } from '../models/index.js';

export const protect = async (req, res, next) => {
  try {
    const bearerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const token = req.cookies?.accessToken || bearerToken;
    if (!token) throw createError('Authentication required.', 401);

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw createError('Account is unavailable.', 401);

    if (user.role === 'bank' && !user.bankId) {
      throw createError('Bank account association is missing.', 403);
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(createError('Invalid or expired session.', 401));
    }
    next(error);
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(createError('You do not have permission for this action.', 403));
  }
  next();
};

export const requireApprovedBank = async (req, res, next) => {
  try {
    if (req.user.role !== 'bank') return next();
    if (!req.user.bankId) {
      throw createError('No bank account is associated with this user.', 403);
    }

    const bank = await Bank.findById(req.user.bankId).select('verificationStatus isActive');
    if (!bank) throw createError('Associated bank account was not found.', 403);
    if (bank.verificationStatus !== 'approved' || !bank.isActive) {
      throw createError('Bank access requires an approved and active bank account.', 403);
    }

    req.bankId = req.user.bankId;
    req.bank = bank;
    next();
  } catch (error) {
    next(error);
  }
};
