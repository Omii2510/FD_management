import mongoose from 'mongoose';
import {
  AdCampaign,
  Advertisement,
  AdEvent,
  AuditLog,
  FDPlan,
  Payment,
} from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import {
  adEventSchema,
  createAdvertisementSchema,
  createCampaignSchema,
  reviewAdvertisementSchema,
  updateCampaignSchema,
  updateAdvertisementSchema,
  updateAdvertisementStatusSchema,
} from '../validators/ad.validators.js';
import { uploadAdvertisementBanner } from '../services/cloudinary.service.js';

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

const decimal = (value) => mongoose.Types.Decimal128.fromString(String(value));

export const listMyCampaigns = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { bankId: req.user.bankId };
    if (req.query.status) filter.status = req.query.status;
    const [campaigns, total] = await Promise.all([
      AdCampaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AdCampaign.countDocuments(filter),
    ]);
    res.json({ success: true, data: { campaigns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    next(error);
  }
};

export const createCampaign = async (req, res, next) => {
  try {
    const payload = parseOrThrow(createCampaignSchema, req.body);
    const campaign = await AdCampaign.create({
      bankId: req.user.bankId,
      campaignName: payload.campaignName,
      campaignType: payload.campaignType,
      totalBudget: decimal(payload.totalBudget),
      startAt: payload.startAt,
      endAt: payload.endAt,
      status: 'draft',
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'campaign.created',
      entityType: 'AdCampaign',
      entityId: campaign._id,
      newData: campaign.toObject(),
    });
    res.status(201).json({ success: true, message: 'Campaign created.', data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateCampaignSchema, req.body);
    const campaign = await AdCampaign.findById(req.params.campaignId);
    if (!campaign) throw createError('Campaign not found.', 404);
    if (campaign.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only manage your bank campaigns.', 403);
    }
    if (!['draft', 'pending_payment'].includes(campaign.status)) {
      throw createError('Only draft or pending-payment campaigns can be edited.', 409);
    }
    const startAt = payload.startAt ?? campaign.startAt;
    const endAt = payload.endAt ?? campaign.endAt;
    if (endAt < startAt) throw createError('endAt must be after startAt.', 400);

    const oldData = campaign.toObject();
    Object.assign(campaign, payload);
    if (payload.totalBudget !== undefined) campaign.totalBudget = decimal(payload.totalBudget);
    await campaign.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'campaign.updated',
      entityType: 'AdCampaign',
      entityId: campaign._id,
      oldData,
      newData: campaign.toObject(),
    });
    res.json({ success: true, message: 'Campaign updated.', data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const submitCampaign = async (req, res, next) => {
  try {
    const campaign = await AdCampaign.findById(req.params.campaignId);
    if (!campaign) throw createError('Campaign not found.', 404);
    if (campaign.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only manage your bank campaigns.', 403);
    }
    if (campaign.status !== 'draft') throw createError('Only draft campaigns can be submitted.', 409);
    campaign.status = 'pending_payment';
    await campaign.save();
    await Payment.create({
      bankId: campaign.bankId,
      campaignId: campaign._id,
      amount: campaign.totalBudget,
      currency: 'INR',
      gateway: 'manual',
      status: 'created',
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'campaign.submitted',
      entityType: 'AdCampaign',
      entityId: campaign._id,
      newData: campaign.toObject(),
    });
    res.json({ success: true, message: 'Campaign submitted and pending payment.', data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const listMyAdvertisements = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { bankId: req.user.bankId };
    if (req.query.status) filter.status = req.query.status;
    const [advertisements, total] = await Promise.all([
      Advertisement.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Advertisement.countDocuments(filter),
    ]);
    res.json({ success: true, data: { advertisements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    next(error);
  }
};

export const listPendingAdvertisements = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const statuses = ['draft', 'pending_review', 'approved', 'rejected', 'scheduled', 'active', 'paused', 'expired'];
    if (req.query.status && !statuses.includes(req.query.status)) {
      throw createError('Invalid advertisement status filter.', 400);
    }
    const filter = req.query.status ? { status: req.query.status } : { status: 'pending_review' };
    const [advertisements, total] = await Promise.all([
      Advertisement.find(filter)
        .populate('bankId', 'bankName bankCode')
        .populate('fdPlanId', 'planName')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Advertisement.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { advertisements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadBanner = async (req, res, next) => {
  try {
    if (!req.file?.buffer) throw createError('Choose a banner image to upload.', 400);
    const bannerImageUrl = await uploadAdvertisementBanner(req.file.buffer);
    res.status(201).json({
      success: true,
      message: 'Banner uploaded successfully.',
      data: { bannerImageUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const createAdvertisement = async (req, res, next) => {
  try {
    const payload = parseOrThrow(createAdvertisementSchema, req.body);
    if (payload.fdPlanId) {
      const plan = await FDPlan.findOne({ _id: payload.fdPlanId, bankId: req.user.bankId, status: 'approved' });
      if (!plan) throw createError('FD plan must belong to your bank and be approved.', 400);
    }
    const advertisement = await Advertisement.create({
      ...payload,
      bankId: req.user.bankId,
      proposedBudget: decimal(payload.proposedBudget),
      status: 'draft',
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'advertisement.created',
      entityType: 'Advertisement',
      entityId: advertisement._id,
      newData: advertisement.toObject(),
    });
    res.status(201).json({ success: true, message: 'Advertisement created.', data: { advertisement } });
  } catch (error) {
    next(error);
  }
};

export const updateAdvertisement = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateAdvertisementSchema, req.body);
    const advertisement = await Advertisement.findById(req.params.advertisementId);
    if (!advertisement) throw createError('Advertisement not found.', 404);
    if (advertisement.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only manage your bank advertisements.', 403);
    }
    if (!['draft', 'rejected'].includes(advertisement.status)) {
      throw createError('Only draft or rejected advertisements can be edited.', 409);
    }

    const startAt = payload.startAt ?? advertisement.startAt;
    const endAt = payload.endAt ?? advertisement.endAt;
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw createError('endAt must be after startAt.', 400);
    }
    const planId = payload.fdPlanId === undefined ? advertisement.fdPlanId : payload.fdPlanId;
    if (planId) {
      const plan = await FDPlan.findOne({ _id: planId, bankId: req.user.bankId, status: 'approved' });
      if (!plan) throw createError('FD plan must belong to your bank and be approved.', 400);
    }

    const oldData = advertisement.toObject();
    Object.assign(advertisement, payload);
    if (payload.proposedBudget !== undefined) advertisement.proposedBudget = decimal(payload.proposedBudget);
    await advertisement.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'advertisement.updated',
      entityType: 'Advertisement',
      entityId: advertisement._id,
      oldData,
      newData: advertisement.toObject(),
    });
    res.json({ success: true, message: 'Advertisement updated.', data: { advertisement } });
  } catch (error) {
    next(error);
  }
};

export const submitAdvertisement = async (req, res, next) => {
  try {
    const advertisement = await Advertisement.findById(req.params.advertisementId);
    if (!advertisement) throw createError('Advertisement not found.', 404);
    if (advertisement.bankId.toString() !== req.user.bankId.toString()) {
      throw createError('You can only manage your bank advertisements.', 403);
    }
    if (!['draft', 'rejected'].includes(advertisement.status)) {
      throw createError('Only draft or rejected advertisements can be submitted.', 409);
    }
    const oldData = advertisement.toObject();
    advertisement.status = 'pending_review';
    advertisement.rejectionReason = undefined;
    advertisement.reviewedBy = undefined;
    advertisement.reviewedAt = undefined;
    await advertisement.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'advertisement.submitted',
      entityType: 'Advertisement',
      entityId: advertisement._id,
      oldData,
      newData: advertisement.toObject(),
    });
    res.json({ success: true, message: 'Advertisement submitted for review.', data: { advertisement } });
  } catch (error) {
    next(error);
  }
};

export const listPublicAdvertisements = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const now = new Date();
    const filter = {
      status: { $in: ['approved', 'scheduled', 'active'] },
      startAt: { $lte: now },
      endAt: { $gte: now },
    };
    if (req.query.placement) filter.placement = req.query.placement;
    const [advertisements, total] = await Promise.all([
      Advertisement.find(filter).populate('bankId', 'bankName bankCode logoUrl').populate('fdPlanId', 'planName').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Advertisement.countDocuments(filter),
    ]);
    res.json({ success: true, data: { advertisements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    next(error);
  }
};

export const reviewAdvertisement = async (req, res, next) => {
  try {
    const payload = parseOrThrow(reviewAdvertisementSchema, req.body);
    const advertisement = await Advertisement.findById(req.params.advertisementId);
    if (!advertisement) throw createError('Advertisement not found.', 404);
    if (advertisement.status !== 'pending_review') {
      throw createError('Only pending-review advertisements can be moderated.', 409);
    }
    const oldData = advertisement.toObject();
    advertisement.status = payload.status;
    advertisement.reviewedBy = req.user._id;
    advertisement.reviewedAt = new Date();
    advertisement.rejectionReason = payload.status === 'rejected' ? payload.rejectionReason : undefined;
    await advertisement.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: payload.status === 'approved' ? 'advertisement.approved' : 'advertisement.rejected',
      entityType: 'Advertisement',
      entityId: advertisement._id,
      oldData,
      newData: advertisement.toObject(),
    });
    res.json({ success: true, message: `Advertisement ${payload.status}.`, data: { advertisement } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminAdvertisementStatus = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateAdvertisementStatusSchema, req.body);
    const advertisement = await Advertisement.findById(req.params.advertisementId);
    if (!advertisement) throw createError('Advertisement not found.', 404);
    if (payload.status === 'paused' && !['approved', 'scheduled', 'active'].includes(advertisement.status)) {
      throw createError('Only approved advertisements can be paused.', 409);
    }
    if (payload.status === 'active' && advertisement.status !== 'paused') {
      throw createError('Only paused advertisements can be resumed.', 409);
    }
    if (payload.status === 'active' && advertisement.endAt < new Date()) {
      throw createError('Expired advertisements cannot be resumed.', 409);
    }

    const oldData = advertisement.toObject();
    advertisement.status = payload.status;
    await advertisement.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: payload.status === 'paused' ? 'advertisement.paused' : 'advertisement.resumed',
      entityType: 'Advertisement',
      entityId: advertisement._id,
      oldData,
      newData: advertisement.toObject(),
    });
    res.json({ success: true, message: `Advertisement ${payload.status}.`, data: { advertisement } });
  } catch (error) {
    next(error);
  }
};

export const recordAdEvent = async (req, res, next) => {
  try {
    const payload = parseOrThrow(adEventSchema, req.body);
    const ad = await Advertisement.findOne({
      _id: req.params.advertisementId,
      status: { $in: ['approved', 'scheduled', 'active'] },
      startAt: { $lte: new Date() },
      endAt: { $gte: new Date() },
    });
    if (!ad) throw createError('Active advertisement not found.', 404);
    await AdEvent.create({
      advertisementId: ad._id,
      bankId: ad.bankId,
      eventType: payload.eventType,
      occurredAt: new Date(),
      anonymousSessionId: payload.anonymousSessionId,
      placement: ad.placement,
    });
    if (payload.eventType === 'impression') ad.impressionCount += 1;
    if (payload.eventType === 'click') ad.clickCount += 1;
    await ad.save();
    res.status(201).json({ success: true, message: 'Advertisement event recorded.' });
  } catch (error) {
    next(error);
  }
};
