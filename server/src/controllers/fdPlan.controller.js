import mongoose from 'mongoose';
import { Bank, FDPlan, AuditLog } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import { createFDPlanSchema, updateFDPlanSchema, reviewFDPlanSchema } from '../validators/fdPlan.validators.js';

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

const pagination = (req) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50),
});

const cleanPlanPayload = (payload) => {
  const cleaned = { ...payload };
  for (const key of ['termsUrl', 'sourceUrl', 'sourceDocumentUrl']) {
    if (cleaned[key] === '') cleaned[key] = undefined;
  }
  if (cleaned.minAmount !== undefined) cleaned.minAmount = mongoose.Types.Decimal128.fromString(cleaned.minAmount);
  if (cleaned.maxAmount !== undefined) cleaned.maxAmount = mongoose.Types.Decimal128.fromString(cleaned.maxAmount);
  return cleaned;
};

const verifyPlanRanges = (existing, payload) => {
  const minAmount = payload.minAmount ?? existing.minAmount;
  const maxAmount = payload.maxAmount ?? existing.maxAmount;
  const minTenureDays = payload.minTenureDays ?? existing.minTenureDays;
  const maxTenureDays = payload.maxTenureDays ?? existing.maxTenureDays;
  const effectiveFrom = payload.effectiveFrom ?? existing.effectiveFrom;
  const effectiveUntil = payload.effectiveUntil === undefined ? existing.effectiveUntil : payload.effectiveUntil;

  if (maxAmount && Number(maxAmount.toString()) < Number(minAmount.toString())) {
    throw createError('maxAmount must be greater than or equal to minAmount.', 400);
  }
  if (maxTenureDays < minTenureDays) {
    throw createError('maxTenureDays must be greater than or equal to minTenureDays.', 400);
  }
  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw createError('effectiveUntil must be after effectiveFrom.', 400);
  }
};

export const listPublicFDPlans = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    for (const amountField of ['minAmount', 'maxAmount']) {
      if (req.query[amountField] !== undefined) {
        const amount = req.query[amountField];
        if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount) || Number(amount) < 0) {
          throw createError(`${amountField} must be a valid non-negative decimal amount.`, 400);
        }
      }
    }
    const now = new Date();
    const filter = {
      status: 'approved',
      effectiveFrom: { $lte: now },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: now } }],
    };
    if (req.query.bankId) filter.bankId = req.query.bankId;
    if (req.query.interestPayout) filter.interestPayout = req.query.interestPayout;
    if (req.query.minAmount) filter.minAmount = { $lte: mongoose.Types.Decimal128.fromString(req.query.minAmount) };
    if (req.query.maxAmount) filter.maxAmount = { $gte: mongoose.Types.Decimal128.fromString(req.query.maxAmount) };

    const [plans, total] = await Promise.all([
      FDPlan.find(filter).populate('bankId', 'bankName bankCode logoUrl').sort({ standardInterestRate: -1 }).skip((page - 1) * limit).limit(limit),
      FDPlan.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { plans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicFDPlan = async (req, res, next) => {
  try {
    const now = new Date();
    const plan = await FDPlan.findOne({
      _id: req.params.id,
      status: 'approved',
      effectiveFrom: { $lte: now },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: now } }],
    }).populate('bankId', 'bankName bankCode logoUrl');
    if (!plan) throw createError('Approved FD plan not found.', 404);
    res.json({ success: true, data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const listMyFDPlans = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { bankId: req.user.bankId };
    if (req.query.status) filter.status = req.query.status;
    const [plans, total] = await Promise.all([
      FDPlan.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      FDPlan.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { plans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const listAllFDPlans = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.bankId) filter.bankId = req.query.bankId;
    const [plans, total] = await Promise.all([
      FDPlan.find(filter).populate('bankId', 'bankName bankCode').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      FDPlan.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { plans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const createFDPlan = async (req, res, next) => {
  try {
    const payload = cleanPlanPayload(parseOrThrow(createFDPlanSchema, req.body));
    let bankId = req.user.role === 'bank' ? req.user.bankId : payload.bankId;
    if (!bankId) throw createError('bankId is required for an admin-created FD plan.', 400);
    const bank = await Bank.findById(bankId);
    if (!bank) throw createError('Bank not found.', 404);
    if (bank.verificationStatus !== 'approved' || !bank.isActive) {
      throw createError('FD plans can only be created for approved and active banks.', 403);
    }
    delete payload.bankId;
    const plan = await FDPlan.create({
      ...payload,
      bankId,
      status: 'draft',
      submittedBy: req.user._id,
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'fdplan.created',
      entityType: 'FDPlan',
      entityId: plan._id,
      newData: plan.toObject(),
    });
    res.status(201).json({ success: true, message: 'FD plan created as draft.', data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const updateFDPlan = async (req, res, next) => {
  try {
    const payload = cleanPlanPayload(parseOrThrow(updateFDPlanSchema, req.body));
    const plan = await FDPlan.findById(req.params.id);
    if (!plan) throw createError('FD plan not found.', 404);
    if (req.user.role === 'bank' && plan.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only update FD plans belonging to your bank.', 403);
    }
    if (!['draft', 'rejected', 'inactive'].includes(plan.status)) {
      throw createError('Only draft, rejected or inactive FD plans can be edited.', 409);
    }

    verifyPlanRanges(plan, payload);
    const oldData = plan.toObject();
    Object.assign(plan, payload);
    if (req.user.role === 'bank' && plan.status === 'inactive') plan.status = 'draft';
    await plan.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'fdplan.updated',
      entityType: 'FDPlan',
      entityId: plan._id,
      oldData,
      newData: plan.toObject(),
    });
    res.json({ success: true, message: 'FD plan updated successfully.', data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const submitFDPlan = async (req, res, next) => {
  try {
    const plan = await FDPlan.findById(req.params.id);
    if (!plan) throw createError('FD plan not found.', 404);
    if (plan.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only submit FD plans belonging to your bank.', 403);
    }
    if (!['draft', 'rejected'].includes(plan.status)) {
      throw createError('Only draft or rejected FD plans can be submitted.', 409);
    }
    const oldData = plan.toObject();
    plan.status = 'pending_review';
    plan.submittedBy = req.user._id;
    plan.reviewNotes = undefined;
    await plan.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'fdplan.submitted',
      entityType: 'FDPlan',
      entityId: plan._id,
      oldData,
      newData: plan.toObject(),
    });
    res.json({ success: true, message: 'FD plan submitted for review.', data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const reviewFDPlan = async (req, res, next) => {
  try {
    const payload = parseOrThrow(reviewFDPlanSchema, req.body);
    const plan = await FDPlan.findById(req.params.id);
    if (!plan) throw createError('FD plan not found.', 404);
    if (plan.status !== 'pending_review') {
      throw createError('Only pending-review FD plans can be reviewed.', 409);
    }
    const oldData = plan.toObject();
    plan.status = payload.status;
    plan.reviewedBy = req.user._id;
    plan.reviewedAt = new Date();
    plan.reviewNotes = payload.reviewNotes;
    plan.lastVerifiedAt = payload.status === 'approved' ? new Date() : plan.lastVerifiedAt;
    await plan.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: payload.status === 'approved' ? 'fdplan.approved' : 'fdplan.rejected',
      entityType: 'FDPlan',
      entityId: plan._id,
      oldData,
      newData: plan.toObject(),
    });
    res.json({ success: true, message: `FD plan ${payload.status}.`, data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const deactivateFDPlan = async (req, res, next) => {
  try {
    const plan = await FDPlan.findById(req.params.id);
    if (!plan) throw createError('FD plan not found.', 404);
    if (req.user.role === 'bank' && plan.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only deactivate FD plans belonging to your bank.', 403);
    }
    const oldData = plan.toObject();
    plan.status = 'inactive';
    await plan.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'fdplan.deactivated',
      entityType: 'FDPlan',
      entityId: plan._id,
      oldData,
      newData: plan.toObject(),
    });
    res.json({ success: true, message: 'FD plan deactivated successfully.', data: { plan } });
  } catch (error) {
    next(error);
  }
};
