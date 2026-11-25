import { FDPlan } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import { calculateFD } from '../utils/fdCalculator.js';
import { calculateFDSchema, compareFDPlansSchema } from '../validators/fdCalculator.validators.js';

const parseOrThrow = (schema, body) => {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error('Validation failed.');
  error.statusCode = 400;
  error.details = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  throw error;
};

const findEligiblePlan = async (planId) => {
  const now = new Date();
  const plan = await FDPlan.findOne({
    _id: planId,
    status: 'approved',
    effectiveFrom: { $lte: now },
    $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: now } }],
  }).populate('bankId', 'bankName bankCode logoUrl');
  if (!plan) throw createError('Approved FD plan not found.', 404);
  return plan;
};

const validateRequestAgainstPlan = (plan, principal, tenureDays) => {
  const minAmount = Number(plan.minAmount.toString());
  const maxAmount = plan.maxAmount ? Number(plan.maxAmount.toString()) : null;
  if (principal < minAmount || (maxAmount !== null && principal > maxAmount)) {
    throw createError(`Deposit amount must be between ${minAmount} and ${maxAmount ?? 'the plan maximum'} for this plan.`, 400);
  }
  if (tenureDays < plan.minTenureDays || tenureDays > plan.maxTenureDays) {
    throw createError(`Tenure must be between ${plan.minTenureDays} and ${plan.maxTenureDays} days for this plan.`, 400);
  }
};

const buildPlanCalculation = (plan, principal, tenureDays, customerCategory) => {
  const annualRate = customerCategory === 'senior_citizen' && plan.seniorCitizenInterestRate != null
    ? plan.seniorCitizenInterestRate
    : plan.standardInterestRate;
  const calculation = calculateFD({
    principal,
    annualRate,
    tenureDays,
    compoundingFrequency: plan.compoundingFrequency,
  });
  return {
    planId: plan._id,
    planName: plan.planName,
    bank: plan.bankId,
    interestPayout: plan.interestPayout,
    compoundingFrequency: plan.compoundingFrequency,
    ...calculation,
  };
};

export const calculateFDPlan = async (req, res, next) => {
  try {
    const payload = parseOrThrow(calculateFDSchema, req.body);
    if (!payload.planId) {
      throw createError('planId is required for plan-based FD calculations.', 400);
    }
    const plan = await findEligiblePlan(payload.planId);
    validateRequestAgainstPlan(plan, payload.principal, payload.tenureDays);
    const calculation = buildPlanCalculation(plan, payload.principal, payload.tenureDays, payload.customerCategory);
    res.json({
      success: true,
      data: {
        calculation,
        disclaimer: 'Estimates are informational only and exclude tax, premature-withdrawal penalties and bank-specific terms.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const compareFDPlans = async (req, res, next) => {
  try {
    const payload = parseOrThrow(compareFDPlansSchema, req.body);
    const uniquePlanIds = [...new Set(payload.planIds)];
    const calculations = [];

    for (const planId of uniquePlanIds) {
      try {
        const plan = await findEligiblePlan(planId);
        validateRequestAgainstPlan(plan, payload.principal, payload.tenureDays);
        calculations.push(buildPlanCalculation(plan, payload.principal, payload.tenureDays, payload.customerCategory));
      } catch (error) {
        if (error.statusCode === 404) continue;
        throw error;
      }
    }

    if (calculations.length === 0) {
      throw createError('No eligible approved FD plans matched the comparison request.', 404);
    }
    calculations.sort((a, b) => b.maturityAmount - a.maturityAmount);
    res.json({
      success: true,
      data: {
        comparison: calculations,
        disclaimer: 'Estimates are informational only and exclude tax, premature-withdrawal penalties and bank-specific terms.',
      },
    });
  } catch (error) {
    next(error);
  }
};
