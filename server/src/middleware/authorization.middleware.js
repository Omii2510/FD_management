import { createError } from './errorHandler.js';

export const requireUser = (req, res, next) => {
  if (!req.user) return next(createError('Authentication required.', 401));
  if (req.user.role !== 'user') {
    return next(createError('This action is restricted to user accounts.', 403));
  }
  next();
};

export const requireSelf = (getRequestedUserId) => (req, res, next) => {
  const requestedUserId = getRequestedUserId(req);
  if (!requestedUserId) return next(createError('User resource not found.', 404));
  if (req.user.role === 'admin') return next();
  if (requestedUserId.toString() !== req.user._id.toString()) {
    return next(createError('You can only access your own resources.', 403));
  }
  next();
};

export const preventRoleAssignment = (req, res, next) => {
  const forbiddenFields = ['role', 'bankId', 'isActive', 'emailVerifiedAt'];
  const suppliedField = forbiddenFields.find((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
  if (suppliedField) {
    return next(createError(`You cannot assign or change ${suppliedField}.`, 403));
  }
  next();
};
