import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { Application, Favorite, Notification } from '../src/models/index.js';
import { createApplication } from '../src/controllers/userPanel.controller.js';
import { createApplicationSchema } from '../src/validators/userPanel.validators.js';

describe('Phase 8 user panel', () => {
  it('validates application consent and required fields', () => {
    expect(createApplicationSchema.safeParse({
      fdPlanId: '507f1f77bcf86cd799439011',
      depositAmount: 50000,
      tenureDays: 365,
      consent: { dataSharingAccepted: false },
    }).success).toBe(false);

    expect(createApplicationSchema.safeParse({
      fdPlanId: '507f1f77bcf86cd799439011',
      applicantName: 'Test Applicant',
      applicantPhone: '+91 9876543210',
      dateOfBirth: '1990-01-01',
      addressLine: '12 Example Street',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      aadhaarLast4: '1234',
      depositAmount: 50000,
      tenureDays: 365,
      customerCategory: 'standard',
      consent: { dataSharingAccepted: true, noticeVersion: 'v1' },
    }).success).toBe(true);

    expect(createApplicationSchema.safeParse({
      fdPlanId: '507f1f77bcf86cd799439011',
      applicantName: 'Test Applicant',
      applicantPhone: '9876543210',
      dateOfBirth: '1990-01-01',
      addressLine: '12 Example Street',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      aadhaarLast4: '123',
      depositAmount: 50000,
      tenureDays: 365,
      consent: { dataSharingAccepted: true, noticeVersion: 'v1' },
    }).success).toBe(false);
  });

  it('rejects future dates and malformed postal codes', () => {
    const input = {
      fdPlanId: '507f1f77bcf86cd799439011',
      applicantName: 'Test Applicant',
      applicantPhone: '9876543210',
      dateOfBirth: '2999-01-01',
      addressLine: '12 Example Street',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '123',
      aadhaarLast4: '1234',
      depositAmount: 50000,
      tenureDays: 365,
      consent: { dataSharingAccepted: true, noticeVersion: 'v3' },
    };
    expect(createApplicationSchema.safeParse(input).success).toBe(false);
    expect(createApplicationSchema.safeParse({ ...input, dateOfBirth: '1990-01-01', postalCode: '411001' }).success).toBe(true);
  });

  it('does not accept an enquiry before account email verification', async () => {
    const next = vi.fn();
    await createApplication({ user: { emailVerifiedAt: null } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('creates unique favorite and notification model indexes', () => {
    expect(Favorite.schema.indexes().some(([fields, options]) =>
      fields.userId === 1 && fields.fdPlanId === 1 && options.unique === true
    )).toBe(true);
    expect(Notification.schema.indexes().some(([fields]) =>
      fields.userId === 1 && fields.isRead === 1
    )).toBe(true);
  });

  it('requires consent timestamp and bank confirmation for applicable application states', async () => {
    const application = new Application({
      referenceCode: 'FDC-TEST-001',
      userId: new mongoose.Types.ObjectId(),
      bankId: new mongoose.Types.ObjectId(),
      fdPlanId: new mongoose.Types.ObjectId(),
      depositAmount: mongoose.Types.Decimal128.fromString('50000'),
      tenureDays: 365,
      rateSnapshot: 7.25,
      planNameSnapshot: 'Test FD',
      consent: { dataSharingAccepted: true },
      status: 'booked',
    });

    await expect(application.validate()).rejects.toMatchObject({
      errors: {
        'consent.acceptedAt': expect.anything(),
        bankConfirmedAt: expect.anything(),
      },
    });
  });

  it('does not expose the Aadhaar suffix in application JSON', () => {
    const application = new Application({
      referenceCode: 'FDC-PRIVACY-001',
      userId: new mongoose.Types.ObjectId(),
      bankId: new mongoose.Types.ObjectId(),
      fdPlanId: new mongoose.Types.ObjectId(),
      applicantName: 'Test Applicant',
      applicantPhone: '9876543210',
      aadhaarLast4: '1234',
      depositAmount: mongoose.Types.Decimal128.fromString('50000'),
      tenureDays: 365,
      rateSnapshot: 7.25,
      planNameSnapshot: 'Test FD',
    });

    expect(application.toJSON().aadhaarLast4).toBeUndefined();
  });
});
