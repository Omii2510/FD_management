import { z } from 'zod';
import { createBankSchema } from './bank.validators.js';

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createManagedBankSchema = z.object({
  bank: createBankSchema,
  bankUser: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(8).max(72),
  }),
});

export const resetBankUserPasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

