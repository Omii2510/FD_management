import { z } from 'zod';

export const createApplicationSchema = z.object({
  fdPlanId: z.string().min(1),
  applicantName: z.string().trim().min(2).max(100),
  applicantPhone: z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/, 'Enter a valid contact phone number'),
  dateOfBirth: z.coerce.date()
    .refine((value) => value >= new Date('1900-01-01T00:00:00.000Z'), 'Enter a valid date of birth')
    .refine((value) => value <= new Date(), 'Date of birth cannot be in the future'),
  addressLine: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit postal code'),
  aadhaarLast4: z.string().regex(/^\d{4}$/, 'Enter only the last four Aadhaar digits'),
  depositAmount: z.number().positive().max(100000000000),
  tenureDays: z.number().int().positive().max(36500),
  customerCategory: z.enum(['standard', 'senior_citizen']).default('standard'),
  officialBankRedirectUrl: z.union([
    z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'URL must use HTTP or HTTPS'),
    z.literal(''),
  ]).optional(),
  consent: z.object({
    dataSharingAccepted: z.literal(true),
    noticeVersion: z.string().trim().min(1).max(100).default('v1'),
  }),
});

