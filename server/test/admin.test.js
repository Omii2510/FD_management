import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { AuditLog, Bank, Notification, User } from '../src/models/index.js';
import { createManagedBank, resetBankUserPassword } from '../src/controllers/admin.controller.js';
import {
  createManagedBankSchema,
  resetBankUserPasswordSchema,
  updateUserStatusSchema,
} from '../src/validators/admin.validators.js';

describe('Phase 11 admin panel', () => {
  it('validates account status updates', () => {
    expect(updateUserStatusSchema.safeParse({ isActive: true }).success).toBe(true);
    expect(updateUserStatusSchema.safeParse({ isActive: 'false' }).success).toBe(false);
  });

  it('requires both bank details and an initial bank login', () => {
    const bank = {
      bankName: 'Example Bank',
      bankCode: 'EXB',
      bankType: 'private',
    };
    expect(createManagedBankSchema.safeParse({
      bank,
      bankUser: { fullName: 'Bank Contact', email: 'contact@example.test', password: 'secure-password' },
    }).success).toBe(true);
    expect(createManagedBankSchema.safeParse({ bank }).success).toBe(false);
    expect(resetBankUserPasswordSchema.safeParse({ password: 'short' }).success).toBe(false);
  });

  it('creates a pending bank and linked login as one recoverable operation', async () => {
    const bank = {
      _id: new mongoose.Types.ObjectId(),
      bankName: 'Example Bank',
      bankCode: 'EXB',
    };
    const user = {
      _id: new mongoose.Types.ObjectId(),
      email: 'contact@example.test',
      toJSON: () => ({ _id: user._id, email: user.email }),
    };
    const original = {
      bankFindOne: Bank.findOne,
      userFindOne: User.findOne,
      bankCreate: Bank.create,
      userCreate: User.create,
      auditCreate: AuditLog.create,
      userDeleteOne: User.deleteOne,
      bankDeleteOne: Bank.deleteOne,
    };
    const next = vi.fn();
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    try {
      vi.spyOn(Bank, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(Bank, 'create').mockResolvedValue(bank);
      vi.spyOn(User, 'create').mockResolvedValue(user);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});
      vi.spyOn(User, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      vi.spyOn(Bank, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      await createManagedBank({
        body: {
          bank: { bankName: 'Example Bank', bankCode: 'exb', bankType: 'private', isActive: true },
          bankUser: { fullName: 'Bank Contact', email: 'contact@example.test', password: 'secure-password' },
        },
        user: { _id: new mongoose.Types.ObjectId() },
      }, response, next);

      expect(Bank.create).toHaveBeenCalledWith(expect.objectContaining({
        bankCode: 'EXB',
        verificationStatus: 'pending',
        isActive: false,
      }));
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        role: 'bank',
        bankId: bank._id,
        emailVerifiedAt: expect.any(Date),
      }));
      expect(response.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      Object.assign(Bank, { findOne: original.bankFindOne, create: original.bankCreate, deleteOne: original.bankDeleteOne });
      Object.assign(User, { findOne: original.userFindOne, create: original.userCreate, deleteOne: original.userDeleteOne });
      Object.assign(AuditLog, { create: original.auditCreate });
    }
  });

  it('removes the bank and linked login if audit recording fails', async () => {
    const bank = { _id: new mongoose.Types.ObjectId() };
    const auditError = new Error('audit storage unavailable');
    const original = {
      bankFindOne: Bank.findOne,
      userFindOne: User.findOne,
      bankCreate: Bank.create,
      userCreate: User.create,
      auditCreate: AuditLog.create,
      userDeleteOne: User.deleteOne,
      bankDeleteOne: Bank.deleteOne,
    };
    const next = vi.fn();
    try {
      vi.spyOn(Bank, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(Bank, 'create').mockResolvedValue(bank);
      vi.spyOn(User, 'create').mockResolvedValue({ email: 'contact@example.test' });
      vi.spyOn(AuditLog, 'create').mockRejectedValue(auditError);
      vi.spyOn(User, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      vi.spyOn(Bank, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      await createManagedBank({
        body: {
          bank: { bankName: 'Example Bank', bankCode: 'EXB', bankType: 'private' },
          bankUser: { fullName: 'Bank Contact', email: 'contact@example.test', password: 'secure-password' },
        },
        user: { _id: new mongoose.Types.ObjectId() },
      }, {}, next);

      expect(User.deleteOne).toHaveBeenCalledWith({ bankId: bank._id, email: 'contact@example.test' });
      expect(Bank.deleteOne).toHaveBeenCalledWith({ _id: bank._id });
      expect(next).toHaveBeenCalledWith(auditError);
    } finally {
      vi.restoreAllMocks();
      Object.assign(Bank, { findOne: original.bankFindOne, create: original.bankCreate, deleteOne: original.bankDeleteOne });
      Object.assign(User, { findOne: original.userFindOne, create: original.userCreate, deleteOne: original.userDeleteOne });
      Object.assign(AuditLog, { create: original.auditCreate });
    }
  });

  it('resets only bank-user passwords and invalidates their refresh session', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      role: 'bank',
      email: 'contact@example.test',
      passwordHash: 'old-hash',
      refreshTokenHash: 'refresh-hash',
      refreshTokenExpires: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
      toJSON: () => ({ email: user.email, role: user.role }),
    };
    const originalFindOne = User.findOne;
    const originalAuditCreate = AuditLog.create;
    const next = vi.fn();
    const response = { json: vi.fn() };
    try {
      vi.spyOn(User, 'findOne').mockResolvedValue(user);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});
      await resetBankUserPassword({
        params: { userId: user._id.toString() },
        body: { password: 'new-secure-password' },
        user: { _id: new mongoose.Types.ObjectId() },
      }, response, next);

      expect(user.passwordHash).toBe('new-secure-password');
      expect(user.refreshTokenHash).toBeNull();
      expect(user.refreshTokenExpires).toBeNull();
      expect(user.save).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      Object.assign(User, { findOne: originalFindOne });
      Object.assign(AuditLog, { create: originalAuditCreate });
    }
  });

  it('creates user, audit, and notification models with required fields', async () => {
    const user = new User({
      fullName: 'Admin Test',
      email: 'admin.test@example.test',
      role: 'admin',
      authProvider: 'local',
    });
    await expect(user.validate()).resolves.toBeUndefined();

    const audit = new AuditLog({
      performedBy: new mongoose.Types.ObjectId(),
      action: 'user.deactivated',
      entityType: 'User',
      entityId: new mongoose.Types.ObjectId(),
      newData: { isActive: false },
    });
    await expect(audit.validate()).resolves.toBeUndefined();

    const notification = new Notification({
      userId: new mongoose.Types.ObjectId(),
      type: 'bank_verified',
      title: 'Verification updated',
      message: 'Your bank verification status changed.',
      relatedEntityType: 'Bank',
      relatedEntityId: new mongoose.Types.ObjectId(),
    });
    await expect(notification.validate()).resolves.toBeUndefined();
  });

  it('defines admin filtering indexes', () => {
    expect(User.schema.indexes().some(([fields]) =>
      fields.role === 1 && fields.isActive === 1
    )).toBe(true);
    expect(AuditLog.schema.indexes().some(([fields]) =>
      fields.action === 1 && fields.createdAt === -1
    )).toBe(true);
  });
});
