import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { Application, AuditLog } from '../src/models/index.js';
import { addBankApplicationNote } from '../src/controllers/bankPanel.controller.js';
import {
  createApplicationNoteSchema,
  updateApplicationStatusSchema,
} from '../src/validators/bankPanel.validators.js';

describe('Phase 10 bank panel', () => {
  it('validates bank application status updates', () => {
    expect(updateApplicationStatusSchema.safeParse({
      status: 'bank_processing',
      bankReferenceId: 'BANK-REF-001',
    }).success).toBe(true);
    expect(updateApplicationStatusSchema.safeParse({
      status: 'approved',
    }).success).toBe(false);
  });

  it('validates internal notes and persists them only within the bank scope', async () => {
    expect(createApplicationNoteSchema.safeParse({ note: 'Follow up tomorrow.' }).success).toBe(true);
    expect(createApplicationNoteSchema.safeParse({ note: ' ' }).success).toBe(false);

    const bankId = new mongoose.Types.ObjectId();
    const application = {
      _id: new mongoose.Types.ObjectId(),
      bankId,
      internalNotes: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    const originalFindOne = Application.findOne;
    const originalAuditCreate = AuditLog.create;
    const next = vi.fn();
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    try {
      const select = vi.fn().mockResolvedValue(application);
      vi.spyOn(Application, 'findOne').mockReturnValue({ select });
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});
      const authorId = new mongoose.Types.ObjectId();
      await addBankApplicationNote({
        params: { applicationId: application._id.toString() },
        body: { note: 'Follow up tomorrow.' },
        user: { _id: authorId, bankId },
      }, response, next);

      expect(Application.findOne).toHaveBeenCalledWith({ _id: application._id.toString(), bankId });
      expect(select).toHaveBeenCalledWith('+internalNotes');
      expect(application.internalNotes[0]).toMatchObject({ note: 'Follow up tomorrow.', createdBy: authorId });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      Object.assign(Application, { findOne: originalFindOne });
      Object.assign(AuditLog, { create: originalAuditCreate });
    }
  });

  it('requires bank confirmation for booked applications', async () => {
    const application = new Application({
      referenceCode: 'FDC-BANK-001',
      userId: new mongoose.Types.ObjectId(),
      bankId: new mongoose.Types.ObjectId(),
      fdPlanId: new mongoose.Types.ObjectId(),
      depositAmount: mongoose.Types.Decimal128.fromString('50000'),
      tenureDays: 365,
      rateSnapshot: 7.25,
      planNameSnapshot: 'Bank Test FD',
      consent: { dataSharingAccepted: true, acceptedAt: new Date() },
      status: 'booked',
    });

    await expect(application.validate()).rejects.toMatchObject({
      errors: { bankConfirmedAt: expect.anything() },
    });
  });

  it('indexes bank applications for panel queries', () => {
    expect(Application.schema.indexes().some(([fields]) =>
      fields.bankId === 1 && fields.status === 1
    )).toBe(true);
    expect(Application.schema.path('internalNotes').options.select).toBe(false);
  });
});
