import { createError } from './errorHandler.js';

export const requireBankOwnership = (resourceBankId) => (req, res, next) => {
  if (req.user.role !== 'bank') return next();
  if (!req.user.bankId) return next(createError('No bank is associated with this account.', 403));

  const ownedBankId = typeof resourceBankId === 'function'
    ? resourceBankId(req)
    : resourceBankId;

  if (!ownedBankId || ownedBankId.toString() !== req.user.bankId.toString()) {
    return next(createError('You can only access resources belonging to your bank.', 403));
  }
  next();
};

export const requireBankOwnershipFrom = (getResourceBankId) => async (req, res, next) => {
  try {
    if (req.user.role !== 'bank') return next();
    if (!req.user.bankId) {
      return next(createError('No bank is associated with this account.', 403));
    }

    const ownedBankId = await getResourceBankId(req);
    if (!ownedBankId) return next(createError('Resource not found.', 404));
    if (ownedBankId.toString() !== req.user.bankId.toString()) {
      return next(createError('You can only access resources belonging to your bank.', 403));
    }
    next();
  } catch (error) {
    next(error);
  }
};
