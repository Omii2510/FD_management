import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Application, Favorite, FDPlan, Notification } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import { calculateFD } from '../utils/fdCalculator.js';
import { createApplicationSchema } from '../validators/userPanel.validators.js';

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

const makeReferenceCode = () => {
  const part = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  return `FDC-${part}`;
};

export const listFavorites = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { userId: req.user._id };
    const [favorites, total] = await Promise.all([
      Favorite.find(filter).populate({
        path: 'fdPlanId',
        populate: { path: 'bankId', select: 'bankName bankCode logoUrl' },
      }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Favorite.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { favorites, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const addFavorite = async (req, res, next) => {
  try {
    const fdPlanId = req.params.planId;
    const plan = await FDPlan.findOne({
      _id: fdPlanId,
      status: 'approved',
      effectiveFrom: { $lte: new Date() },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: new Date() } }],
    });
    if (!plan) throw createError('Approved FD plan not found.', 404);

    const favorite = await Favorite.findOneAndUpdate(
      { userId: req.user._id, fdPlanId: plan._id },
      { $setOnInsert: { userId: req.user._id, fdPlanId: plan._id } },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, message: 'FD plan added to favorites.', data: { favorite } });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError('FD plan is already in favorites.', 409));
    }
    next(error);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    const favorite = await Favorite.findOneAndDelete({
      userId: req.user._id,
      fdPlanId: req.params.planId,
    });
    if (!favorite) throw createError('Favorite not found.', 404);
    res.json({ success: true, message: 'FD plan removed from favorites.' });
  } catch (error) {
    next(error);
  }
};

export const createApplication = async (req, res, next) => {
  try {
    if (!req.user.emailVerifiedAt) {
      throw createError('Verify your account email before sending an FD enquiry.', 403);
    }
    const payload = parseOrThrow(createApplicationSchema, req.body);
    const now = new Date();
    const plan = await FDPlan.findOne({
      _id: payload.fdPlanId,
      status: 'approved',
      effectiveFrom: { $lte: now },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: now } }],
    }).populate('bankId');
    if (!plan) throw createError('Approved FD plan not found.', 404);
    if (!plan.bankId || plan.bankId.verificationStatus !== 'approved' || !plan.bankId.isActive) {
      throw createError('This FD plan is not currently available.', 409);
    }

    const minAmount = Number(plan.minAmount.toString());
    const maxAmount = plan.maxAmount ? Number(plan.maxAmount.toString()) : null;
    if (payload.depositAmount < minAmount || (maxAmount !== null && payload.depositAmount > maxAmount)) {
      throw createError(`Deposit amount must be between ${minAmount} and ${maxAmount ?? 'the plan maximum'}.`, 400);
    }
    if (payload.tenureDays < plan.minTenureDays || payload.tenureDays > plan.maxTenureDays) {
      throw createError(`Tenure must be between ${plan.minTenureDays} and ${plan.maxTenureDays} days.`, 400);
    }

    const annualRate = payload.customerCategory === 'senior_citizen' && plan.seniorCitizenInterestRate != null
      ? plan.seniorCitizenInterestRate
      : plan.standardInterestRate;
    const estimate = calculateFD({
      principal: payload.depositAmount,
      annualRate,
      tenureDays: payload.tenureDays,
      compoundingFrequency: plan.compoundingFrequency,
    });

    const application = await Application.create({
      referenceCode: makeReferenceCode(),
      userId: req.user._id,
      bankId: plan.bankId._id,
      fdPlanId: plan._id,
      applicantName: payload.applicantName,
      applicantPhone: payload.applicantPhone,
      phoneVerifiedAt: null,
      dateOfBirth: payload.dateOfBirth,
      addressLine: payload.addressLine,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
      aadhaarLast4: payload.aadhaarLast4,
      kycStatus: 'not_collected',
      depositAmount: mongoose.Types.Decimal128.fromString(payload.depositAmount.toFixed(2)),
      tenureDays: payload.tenureDays,
      customerCategory: payload.customerCategory,
      rateSnapshot: annualRate,
      planNameSnapshot: plan.planName,
      termsSnapshot: {
        interestPayout: plan.interestPayout,
        compoundingFrequency: plan.compoundingFrequency,
        prematureWithdrawalAllowed: plan.prematureWithdrawalAllowed,
        prematureWithdrawalPenaltyDescription: plan.prematureWithdrawalPenaltyDescription,
        taxSavingEligible: plan.taxSavingEligible,
        eligibilityDescription: plan.eligibilityDescription,
        termsUrl: plan.termsUrl,
        sourceUrl: plan.sourceUrl,
      },
      estimatedInterest: mongoose.Types.Decimal128.fromString(estimate.interest.toFixed(2)),
      estimatedMaturityAmount: mongoose.Types.Decimal128.fromString(estimate.maturityAmount.toFixed(2)),
      consent: {
        dataSharingAccepted: true,
        acceptedAt: new Date(),
        noticeVersion: payload.consent.noticeVersion,
      },
      statusHistory: [{
        status: 'initiated',
        changedBy: req.user._id,
        actorRole: 'user',
        changedAt: new Date(),
      }],
      officialBankRedirectUrl: payload.officialBankRedirectUrl || plan.bankId.officialWebsite || undefined,
    });

    await Notification.create({
      userId: req.user._id,
      type: 'application_update',
      title: 'Application initiated',
      message: `Application ${application.referenceCode} was initiated successfully.`,
      relatedEntityType: 'Application',
      relatedEntityId: application._id,
    });

    res.status(201).json({ success: true, message: 'Application initiated.', data: { application } });
  } catch (error) {
    next(error);
  }
};

export const listApplications = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const [applications, total] = await Promise.all([
      Application.find(filter).populate('bankId', 'bankName bankCode logoUrl').populate('fdPlanId', 'planName').populate('statusHistory.changedBy', 'fullName role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Application.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const getApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.applicationId,
      userId: req.user._id,
    }).populate('bankId', 'bankName bankCode logoUrl').populate('fdPlanId', 'planName').populate('statusHistory.changedBy', 'fullName role');
    if (!application) throw createError('Application not found.', 404);
    res.json({ success: true, data: { application } });
  } catch (error) {
    next(error);
  }
};

export const cancelApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.applicationId,
      userId: req.user._id,
    });
    if (!application) throw createError('Application not found.', 404);
    if (!['initiated', 'redirected'].includes(application.status)) {
      throw createError('Only initiated or redirected applications can be cancelled.', 409);
    }
    application.status = 'cancelled';
    application.statusUpdatedAt = new Date();
    application.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user._id,
      actorRole: 'user',
      changedAt: application.statusUpdatedAt,
    });
    await application.save();
    res.json({ success: true, message: 'Application cancelled.', data: { application } });
  } catch (error) {
    next(error);
  }
};

export const listNotifications = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { userId: req.user._id };
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { notifications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) throw createError('Notification not found.', 404);
    res.json({ success: true, message: 'Notification marked as read.', data: { notification } });
  } catch (error) {
    next(error);
  }
};
