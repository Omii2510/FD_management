import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { AuditLog, FDPlan } from '../src/models/index.js';
import { updateFDPlan } from '../src/controllers/fdPlan.controller.js';
import { createFDPlanSchema, reviewFDPlanSchema, updateFDPlanSchema } from '../src/validators/fdPlan.validators.js';

describe('Phase 6 FD plan management', () => {
  it('validates FD plan ranges and required fields', () => {
    const result = createFDPlanSchema.safeParse({
      planName: '12 Month FD',
      minAmount: '10000',
      maxAmount: '5000',
      minTenureDays: 365,
      maxTenureDays: 180,
      standardInterestRate: 7.25,
      seniorCitizenInterestRate: 7.75,
      interestPayout: 'maturity',
      effectiveFrom: '2026-11-23T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('accepts valid FD plan data and decimal amounts', () => {
    const parsed = createFDPlanSchema.parse({
      planName: '12 Month FD',
      minAmount: '10000',
      maxAmount: '100000',
      minTenureDays: 30,
      maxTenureDays: 365,
      standardInterestRate: 7.25,
      interestPayout: 'quarterly',
      compoundingFrequency: 'quarterly',
      effectiveFrom: new Date('2026-11-23T00:00:00.000Z'),
      effectiveUntil: new Date('2027-11-23T00:00:00.000Z'),
    });

    expect(parsed.minAmount).toBe('10000');
  });

  it('rejects privileged and empty update payload fields', () => {
    expect(updateFDPlanSchema.safeParse({}).success).toBe(false);
    expect(updateFDPlanSchema.safeParse({ status: 'approved' }).success).toBe(false);
    expect(updateFDPlanSchema.safeParse({ effectiveUntil: null }).success).toBe(true);
  });

  it('allows only approved or rejected review outcomes', () => {
    expect(reviewFDPlanSchema.safeParse({ status: 'approved', reviewNotes: 'Verified' }).success).toBe(true);
    expect(reviewFDPlanSchema.safeParse({ status: 'draft' }).success).toBe(false);
  });

  it('creates a plan model with valid range fields', async () => {
    const plan = new FDPlan({
      bankId: new mongoose.Types.ObjectId(),
      planName: 'Test FD',
      minAmount: mongoose.Types.Decimal128.fromString('10000'),
      maxAmount: mongoose.Types.Decimal128.fromString('100000'),
      minTenureDays: 30,
      maxTenureDays: 365,
      standardInterestRate: 7.25,
      interestPayout: 'maturity',
      effectiveFrom: new Date('2026-11-23T00:00:00.000Z'),
    });

    await expect(plan.validate()).resolves.toBeUndefined();
  });

  it('returns an inactive bank plan to draft when edited so it can be resubmitted', async () => {
    const bankId = new mongoose.Types.ObjectId();
    const plan = {
      _id: new mongoose.Types.ObjectId(),
      bankId,
      status: 'inactive',
      minAmount: mongoose.Types.Decimal128.fromString('10000'),
      maxAmount: mongoose.Types.Decimal128.fromString('100000'),
      minTenureDays: 30,
      maxTenureDays: 365,
      effectiveFrom: new Date('2026-11-23T00:00:00.000Z'),
      effectiveUntil: null,
      toObject: vi.fn(() => ({ status: plan.status })),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const originalFindById = FDPlan.findById;
    const originalAuditCreate = AuditLog.create;
    const next = vi.fn();
    const response = { json: vi.fn() };
    try {
      vi.spyOn(FDPlan, 'findById').mockResolvedValue(plan);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});
      await updateFDPlan({
        params: { id: plan._id.toString() },
        body: { planName: 'Updated FD plan' },
        user: { _id: new mongoose.Types.ObjectId(), bankId, role: 'bank' },
      }, response, next);

      expect(plan.status).toBe('draft');
      expect(plan.save).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      Object.assign(FDPlan, { findById: originalFindById });
      Object.assign(AuditLog, { create: originalAuditCreate });
    }
  });
});
