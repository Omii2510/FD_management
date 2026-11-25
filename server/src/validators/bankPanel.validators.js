import { z } from 'zod';

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['submitted_to_bank', 'bank_processing', 'booked', 'rejected', 'cancelled', 'expired', 'unknown']),
  bankReferenceId: z.string().trim().min(1).max(150).optional(),
});

export const createApplicationNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});
