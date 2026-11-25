import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { AuditLog, AdCampaign, Advertisement, AdEvent, Payment } from '../src/models/index.js';
import { submitAdvertisement } from '../src/controllers/ad.controller.js';
import { uploadAdvertisementBanner } from '../src/services/cloudinary.service.js';
import {
  adEventSchema,
  createCampaignSchema,
  createAdvertisementSchema,
  reviewAdvertisementSchema,
} from '../src/validators/ad.validators.js';

describe('Phase 9 advertisement and campaign system', () => {
  it('validates campaign schedule and budget', () => {
    expect(createCampaignSchema.safeParse({
      campaignName: 'Spring campaign',
      campaignType: 'fixed_fee',
      totalBudget: '10000',
      startAt: '2026-11-23T00:00:00.000Z',
      endAt: '2026-12-23T00:00:00.000Z',
    }).success).toBe(true);

    expect(createCampaignSchema.safeParse({
      campaignName: 'Invalid campaign',
      campaignType: 'fixed_fee',
      totalBudget: '0',
      startAt: '2026-12-23T00:00:00.000Z',
      endAt: '2026-11-23T00:00:00.000Z',
    }).success).toBe(false);
  });

  it('requires a rejection reason and validates ad events', () => {
    expect(reviewAdvertisementSchema.safeParse({ status: 'rejected' }).success).toBe(false);
    expect(reviewAdvertisementSchema.safeParse({ status: 'rejected', rejectionReason: 'Banner policy violation' }).success).toBe(true);
    expect(adEventSchema.safeParse({ eventType: 'click' }).success).toBe(true);
  });

  it('requires an objective, positive budget, and safe web URLs for ad requests', () => {
    const request = {
      title: 'Featured deposit',
      bannerImageUrl: 'https://res.cloudinary.com/example/image/upload/banner.webp',
      destinationUrl: 'https://bank.example.test/fd',
      placement: 'homepage_banner',
      proposedBudget: '5000',
      campaignObjective: 'plan_enquiries',
      startAt: '2026-11-23T00:00:00.000Z',
      endAt: '2026-12-23T00:00:00.000Z',
    };
    expect(createAdvertisementSchema.safeParse(request).success).toBe(true);
    expect(createAdvertisementSchema.safeParse({ ...request, proposedBudget: '0' }).success).toBe(false);
    expect(createAdvertisementSchema.safeParse({ ...request, destinationUrl: 'javascript:alert(1)' }).success).toBe(false);
    const { campaignObjective, ...withoutObjective } = request;
    expect(createAdvertisementSchema.safeParse(withoutObjective).success).toBe(false);
  });

  it('clears rejection feedback when a bank resubmits an advertisement', async () => {
    const bankId = new mongoose.Types.ObjectId();
    const ad = {
      _id: new mongoose.Types.ObjectId(),
      bankId,
      status: 'rejected',
      rejectionReason: 'Please update the banner.',
      reviewedBy: new mongoose.Types.ObjectId(),
      reviewedAt: new Date(),
      toObject: vi.fn(() => ({ status: ad.status, rejectionReason: ad.rejectionReason })),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const originalFindById = Advertisement.findById;
    const originalAuditCreate = AuditLog.create;
    const next = vi.fn();
    const response = { json: vi.fn() };
    try {
      vi.spyOn(Advertisement, 'findById').mockResolvedValue(ad);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});
      await submitAdvertisement({
        params: { advertisementId: ad._id.toString() },
        user: { _id: new mongoose.Types.ObjectId(), bankId },
      }, response, next);

      expect(ad.status).toBe('pending_review');
      expect(ad.rejectionReason).toBeUndefined();
      expect(ad.reviewedBy).toBeUndefined();
      expect(ad.save).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      Object.assign(Advertisement, { findById: originalFindById });
      Object.assign(AuditLog, { create: originalAuditCreate });
    }
  });

  it('reports missing Cloudinary configuration rather than accepting an unhosted upload', async () => {
    const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    keys.forEach((key) => { delete process.env[key]; });
    try {
      await expect(uploadAdvertisementBanner(Buffer.from('not-an-image'))).rejects.toMatchObject({
        statusCode: 503,
      });
    } finally {
      keys.forEach((key) => {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      });
    }
  });

  it('validates campaign and advertisement schedules', async () => {
    const campaign = new AdCampaign({
      bankId: new mongoose.Types.ObjectId(),
      campaignName: 'Test campaign',
      campaignType: 'cpm',
      totalBudget: mongoose.Types.Decimal128.fromString('1000'),
      startAt: new Date('2026-12-01T00:00:00.000Z'),
      endAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    await expect(campaign.validate()).rejects.toMatchObject({
      errors: { endAt: expect.anything() },
    });

    const advertisement = new Advertisement({
      bankId: new mongoose.Types.ObjectId(),
      title: 'Test advertisement',
      bannerImageUrl: 'https://example.test/banner.png',
      destinationUrl: 'https://example.test',
      placement: 'homepage_banner',
      startAt: new Date('2026-11-01T00:00:00.000Z'),
      endAt: new Date('2026-12-01T00:00:00.000Z'),
    });
    await expect(advertisement.validate()).resolves.toBeUndefined();
  });

  it('defines required ad event and payment indexes', () => {
    expect(AdEvent.schema.indexes().some(([fields]) =>
      fields.advertisementId === 1 && fields.eventType === 1
    )).toBe(true);
    expect(Payment.schema.indexes().some(([fields]) =>
      fields.bankId === 1 && fields.status === 1
    )).toBe(true);
  });
});
