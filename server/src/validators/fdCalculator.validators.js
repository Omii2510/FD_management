import { z } from 'zod';

export const calculateFDSchema = z.object({
  planId: z.string().optional(),
  principal: z.number().positive().max(100000000000),
  tenureDays: z.number().int().positive().max(36500),
  customerCategory: z.enum(['standard', 'senior_citizen']).default('standard'),
});

export const compareFDPlansSchema = z.object({
  planIds: z.array(z.string().min(1)).min(1).max(10),
  principal: z.number().positive().max(100000000000),
  tenureDays: z.number().int().positive().max(36500),
  customerCategory: z.enum(['standard', 'senior_citizen']).default('standard'),
});
