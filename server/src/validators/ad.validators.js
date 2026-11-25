import { z } from 'zod';

const decimalAmount = z.union([z.number().finite().nonnegative(), z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/)])
  .transform((value) => String(value));
const publicUrl = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'URL must use HTTP or HTTPS');
const budget = decimalAmount.refine((value) => Number(value) > 0, 'proposedBudget must be greater than zero');
const objective = z.enum(['brand_awareness', 'plan_enquiries', 'website_traffic', 'other']);
const placement = z.enum(['homepage_banner', 'featured_fd', 'sponsored_search', 'sidebar']);
const scheduleDate = z.union([z.string().datetime({ offset: true }), z.coerce.date()]);

export const createCampaignSchema = z.object({
  campaignName: z.string().trim().min(2).max(150),
  campaignType: z.enum(['fixed_fee', 'cpc', 'cpm']),
  totalBudget: decimalAmount.refine((value) => Number(value) > 0, 'totalBudget must be greater than zero'),
  startAt: z.union([z.string().datetime({ offset: true }), z.coerce.date()]),
  endAt: z.union([z.string().datetime({ offset: true }), z.coerce.date()]),
}).refine((value) => value.endAt >= value.startAt, {
  message: 'endAt must be after startAt',
  path: ['endAt'],
});

export const updateCampaignSchema = z.object({
  campaignName: z.string().trim().min(2).max(150).optional(),
  campaignType: z.enum(['fixed_fee', 'cpc', 'cpm']).optional(),
  totalBudget: decimalAmount.optional(),
  startAt: z.union([z.string().datetime({ offset: true }), z.coerce.date()]).optional(),
  endAt: z.union([z.string().datetime({ offset: true }), z.coerce.date()]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one campaign field is required.');

export const createAdvertisementSchema = z.object({
  fdPlanId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(3000).optional(),
  bannerImageUrl: publicUrl,
  destinationUrl: publicUrl,
  proposedBudget: budget,
  campaignObjective: objective,
  objectiveDetails: z.string().trim().max(2000).optional(),
  placement,
  startAt: scheduleDate,
  endAt: scheduleDate,
}).refine((value) => value.endAt >= value.startAt, {
  message: 'endAt must be after startAt',
  path: ['endAt'],
});

export const updateAdvertisementSchema = z.object({
  fdPlanId: z.union([z.string().min(1), z.null()]).optional(),
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(3000).optional(),
  bannerImageUrl: publicUrl.optional(),
  destinationUrl: publicUrl.optional(),
  proposedBudget: budget.optional(),
  campaignObjective: objective.optional(),
  objectiveDetails: z.string().trim().max(2000).optional(),
  placement: placement.optional(),
  startAt: scheduleDate.optional(),
  endAt: scheduleDate.optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one advertisement field is required.');

export const reviewAdvertisementSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(2000).optional(),
}).refine((value) => value.status !== 'rejected' || Boolean(value.rejectionReason), {
  message: 'rejectionReason is required when rejecting an advertisement',
  path: ['rejectionReason'],
});

export const updateAdvertisementStatusSchema = z.object({
  status: z.enum(['active', 'paused']),
});

export const adEventSchema = z.object({
  eventType: z.enum(['impression', 'click']),
  anonymousSessionId: z.string().trim().min(1).max(200).optional(),
});
