import { describe, expect, it } from 'vitest';
import { calculateFD } from '../src/utils/fdCalculator.js';
import { calculateFDSchema, compareFDPlansSchema } from '../src/validators/fdCalculator.validators.js';

describe('Phase 7 FD calculator and comparison', () => {
  it('calculates quarterly compounded maturity', () => {
    const result = calculateFD({
      principal: 100000,
      annualRate: 7.25,
      tenureDays: 365,
      compoundingFrequency: 'quarterly',
    });

    expect(result.maturityAmount).toBeGreaterThan(107400);
    expect(result.maturityAmount).toBeLessThan(107600);
    expect(result.interest).toBe(result.maturityAmount - result.principal);
  });

  it('calculates simple maturity for none compounding', () => {
    const result = calculateFD({
      principal: 100000,
      annualRate: 10,
      tenureDays: 365,
      compoundingFrequency: 'none',
    });

    expect(result.maturityAmount).toBe(110000);
    expect(result.interest).toBe(10000);
  });

  it('rejects invalid principal and tenure values', () => {
    expect(() => calculateFD({
      principal: 0,
      annualRate: 7,
      tenureDays: 365,
    })).toThrow('principal must be greater than zero');
  });

  it('validates calculation and comparison requests', () => {
    expect(calculateFDSchema.safeParse({
      planId: '507f1f77bcf86cd799439011',
      principal: 50000,
      tenureDays: 365,
    }).success).toBe(true);
    expect(compareFDPlansSchema.safeParse({
      planIds: [],
      principal: 50000,
      tenureDays: 365,
    }).success).toBe(false);
  });
});
