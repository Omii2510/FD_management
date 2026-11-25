import { z } from 'zod';

const optionalUrl = z.union([z.string().trim().url(), z.literal('')]).optional();
const optionalEmail = z.union([z.string().trim().email().toLowerCase(), z.literal('')]).optional();

export const createBankSchema = z.object({
  bankName: z.string().trim().min(2).max(150),
  bankCode: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Bank code may contain only letters, numbers, underscores and hyphens'),
  bankType: z.enum(['public', 'private', 'small_finance', 'cooperative', 'other']),
  logoUrl: optionalUrl,
  description: z.string().trim().max(3000).optional(),
  officialWebsite: optionalUrl,
  contactEmail: optionalEmail,
  customerCare: z.string().trim().max(100).optional(),
  headquarters: z.string().trim().max(200).optional(),
  verificationStatus: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  isActive: z.boolean().optional(),
});

export const updateBankSchema = z.object({
  bankName: z.string().trim().min(2).max(150).optional(),
  bankCode: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Bank code may contain only letters, numbers, underscores and hyphens').optional(),
  bankType: z.enum(['public', 'private', 'small_finance', 'cooperative', 'other']).optional(),
  logoUrl: optionalUrl,
  description: z.string().trim().max(3000).optional(),
  officialWebsite: optionalUrl,
  contactEmail: optionalEmail,
  customerCare: z.string().trim().max(100).optional(),
  headquarters: z.string().trim().max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one bank field is required.');

export const updateBankStatusSchema = z.object({
  verificationStatus: z.enum(['pending', 'approved', 'rejected', 'suspended']),
  verificationNotes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const updateMyBankSchema = z.object({
  logoUrl: optionalUrl,
  description: z.string().trim().max(3000).optional(),
  officialWebsite: optionalUrl,
  contactEmail: optionalEmail,
  customerCare: z.string().trim().max(100).optional(),
  headquarters: z.string().trim().max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one bank field is required.');

