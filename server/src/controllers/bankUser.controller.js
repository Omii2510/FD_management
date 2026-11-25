import { z } from 'zod';
import { AuditLog, Bank, User } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';

const bankUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72),
  bankId: z.string().min(1),
});

export const createBankUser = async (req, res, next) => {
  try {
    const parsed = bankUserSchema.parse(req.body);
    const bank = await Bank.findById(parsed.bankId);
    if (!bank) throw createError('Bank not found.', 404);
    if (bank.verificationStatus !== 'approved' || !bank.isActive) {
      throw createError('Bank access requires an approved and active bank.', 403);
    }

    if (await User.findOne({ email: parsed.email })) {
      throw createError('An account with this email already exists.', 409);
    }

    const user = await User.create({
      fullName: parsed.fullName,
      email: parsed.email,
      passwordHash: parsed.password,
      authProvider: 'local',
      role: 'bank',
      bankId: bank._id,
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank_user.created',
      entityType: 'User',
      entityId: user._id,
      newData: { email: user.email, role: user.role, bankId: bank._id },
    });

    res.status(201).json({
      success: true,
      message: 'Bank user created successfully.',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      error.statusCode = 400;
      error.details = error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    }
    next(error);
  }
};
