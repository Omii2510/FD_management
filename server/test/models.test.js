import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { User, Bank, FDPlan, Application, Advertisement, Favorite } from '../src/models/index.js';

describe('Phase 2 Mongoose models', () => {
  it('requires a bank for a bank-role user', async () => {
    const user = new User({
      fullName: 'Test Bank User',
      email: 'bank@example.test',
      role: 'bank',
      authProvider: 'local',
    });
    await expect(user.validate()).rejects.toMatchObject({
      errors: { bankId: expect.anything() },
    });
  });

  it('validates bank range and status fields', async () => {
    const bank = new Bank({
      bankName: 'Test Bank',
      bankCode: 'test01',
      bankType: 'private',
    });
    await expect(bank.validate()).resolves.toBeUndefined();

    const plan = new FDPlan({
      bankId: new mongoose.Types.ObjectId(),
      planName: 'Test FD',
      minAmount: mongoose.Types.Decimal128.fromString('50000'),
      maxAmount: mongoose.Types.Decimal128.fromString('10000'),
      minTenureDays: 365,
      maxTenureDays: 180,
      standardInterestRate: 7,
      interestPayout: 'maturity',
      effectiveFrom: new Date(),
    });
    await expect(plan.validate()).rejects.toMatchObject({
      errors: {
        maxAmount: expect.anything(),
        maxTenureDays: expect.anything(),
      },
    });
  });

  it('requires consent timestamp and bank confirmation for relevant application states', async () => {
    const application = new Application({
      referenceCode: 'TEST-001',
      userId: new mongoose.Types.ObjectId(),
      bankId: new mongoose.Types.ObjectId(),
      fdPlanId: new mongoose.Types.ObjectId(),
      depositAmount: mongoose.Types.Decimal128.fromString('10000'),
      tenureDays: 180,
      rateSnapshot: 7,
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

  it('adds required indexes and unique constraints', () => {
    const favoriteIndexes = Favorite.schema.indexes();
    expect(favoriteIndexes.some(([fields, options]) =>
      fields.userId === 1 && fields.fdPlanId === 1 && options.unique === true
    )).toBe(true);
    expect(Bank.schema.indexes().some(([fields]) => fields.bankName === 'text')).toBe(true);
    expect(Application.schema.path('referenceCode').options.unique).toBe(true);
  });

  it('rejects an invalid advertisement schedule', async () => {
    const advertisement = new Advertisement({
      bankId: new mongoose.Types.ObjectId(),
      title: 'Test Ad',
      bannerImageUrl: 'https://example.test/ad.png',
      destinationUrl: 'https://example.test',
      placement: 'homepage_banner',
      startAt: new Date('2026-12-01'),
      endAt: new Date('2026-11-01'),
    });
    await expect(advertisement.validate()).rejects.toMatchObject({
      errors: { endAt: expect.anything() },
    });
  });
});
