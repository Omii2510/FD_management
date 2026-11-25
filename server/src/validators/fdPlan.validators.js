import { z } from 'zod';

const optionalUrl = z.union([z.string().trim().url(), z.literal('')]).optional();
const decimalAmount = z.union([z.number().finite(), z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/, 'Must be a valid decimal amount')])
  .transform((value) => String(value));

const planFields = {
  planName: z.string().trim().min(2).max(150),
  description: z.string().trim().max(3000).optional(),
  minAmount: decimalAmount.refine((value) => Number(value) > 0, 'minAmount must be greater than zero'),
  maxAmount: decimalAmount.optional(),
  minTenureDays: z.number().int().min(1).max(36500),
  maxTenureDays: z.number().int().min(1).max(36500),
  standardInterestRate: z.number().min(0).max(20),
  seniorCitizenInterestRate: z.number().min(0).max(20).optional(),
  interestPayout: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly', 'maturity']),
  compoundingFrequency: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly', 'none']).optional(),
  calculationMethod: z.string().trim().max(500).optional(),
  prematureWithdrawalAllowed: z.boolean().optional(),
  prematureWithdrawalPenaltyDescription: z.string().trim().max(2000).optional(),
  taxSavingEligible: z.boolean().optional(),
  eligibilityDescription: z.string().trim().max(3000).optional(),
  termsUrl: optionalUrl,
  sourceUrl: optionalUrl,
  sourceDocumentUrl: optionalUrl,
  effectiveFrom: z.union([z.string().datetime({ offset: true }), z.coerce.date()]),
  effectiveUntil: z.union([z.string().datetime({ offset: true }), z.coerce.date()]).optional(),
};

export const createFDPlanSchema = z.object({
  ...planFields,
  bankId: z.string().min(1).optional(),
}).refine((value) => value.maxAmount === undefined || Number(value.maxAmount) >= Number(value.minAmount), {
  message: 'maxAmount must be greater than or equal to minAmount',
  path: ['maxAmount'],
}).refine((value) => value.maxTenureDays >= value.minTenureDays, {
  message: 'maxTenureDays must be greater than or equal to minTenureDays',
  path: ['maxTenureDays'],
}).refine((value) => value.effectiveUntil === undefined || value.effectiveUntil >= value.effectiveFrom, {
  message: 'effectiveUntil must be after effectiveFrom',
  path: ['effectiveUntil'],
});

export const updateFDPlanSchema = z.object({
  planName: planFields.planName.optional(),
  description: planFields.description,
  minAmount: planFields.minAmount.optional(),
  maxAmount: planFields.maxAmount,
  minTenureDays: planFields.minTenureDays.optional(),
  maxTenureDays: planFields.maxTenureDays.optional(),
  standardInterestRate: planFields.standardInterestRate.optional(),
  seniorCitizenInterestRate: planFields.seniorCitizenInterestRate,
  interestPayout: planFields.interestPayout.optional(),
  compoundingFrequency: planFields.compoundingFrequency,
  calculationMethod: planFields.calculationMethod,
  prematureWithdrawalAllowed: planFields.prematureWithdrawalAllowed,
  prematureWithdrawalPenaltyDescription: planFields.prematureWithdrawalPenaltyDescription,
  taxSavingEligible: planFields.taxSavingEligible,
  eligibilityDescription: planFields.eligibilityDescription,
  termsUrl: optionalUrl,
  sourceUrl: optionalUrl,
  sourceDocumentUrl: optionalUrl,
  effectiveFrom: planFields.effectiveFrom.optional(),
  effectiveUntil: z.union([
    planFields.effectiveUntil.unwrap(),
    z.null(),
  ]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one FD plan field is required.');

export const reviewFDPlanSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().trim().max(2000).optional(),
});
