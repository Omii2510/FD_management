import {
  AdCampaign,
  Advertisement,
  Application,
  AuditLog,
  FDPlan,
  Notification,
  User,
} from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import {
  createApplicationNoteSchema,
  updateApplicationStatusSchema,
} from '../validators/bankPanel.validators.js';

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

export const getBankDashboard = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    const [
      planCount,
      approvedPlanCount,
      pendingPlanCount,
      applicationCount,
      activeApplicationCount,
      bookedApplicationCount,
      campaignCount,
      advertisementCount,
      activeAdvertisementCount,
      recentApplications,
    ] = await Promise.all([
      FDPlan.countDocuments({ bankId }),
      FDPlan.countDocuments({ bankId, status: 'approved' }),
      FDPlan.countDocuments({ bankId, status: 'pending_review' }),
      Application.countDocuments({ bankId }),
      Application.countDocuments({ bankId, status: { $in: ['initiated', 'redirected', 'submitted_to_bank', 'bank_processing'] } }),
      Application.countDocuments({ bankId, status: 'booked' }),
      AdCampaign.countDocuments({ bankId }),
      Advertisement.countDocuments({ bankId }),
      Advertisement.countDocuments({ bankId, status: { $in: ['approved', 'scheduled', 'active'] } }),
      Application.find({ bankId })
        .select('referenceCode applicantName userId planNameSnapshot status createdAt depositAmount statusUpdatedAt')
        .populate('userId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      data: {
        plans: { total: planCount, approved: approvedPlanCount, pendingReview: pendingPlanCount },
        applications: { total: applicationCount, active: activeApplicationCount, booked: bookedApplicationCount },
        campaigns: { total: campaignCount },
        advertisements: { total: advertisementCount, active: activeAdvertisementCount },
        recentApplications,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listBankApplications = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { bankId: req.user.bankId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.referenceCode) filter.referenceCode = req.query.referenceCode.toUpperCase();

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('userId', 'fullName email phone emailVerifiedAt')
        .populate('fdPlanId', 'planName')
        .populate('statusHistory.changedBy', 'fullName role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
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

export const getBankApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.applicationId,
      bankId: req.user.bankId,
    })
      .select('+internalNotes')
      .populate('userId', 'fullName email phone emailVerifiedAt')
      .populate('fdPlanId', 'planName description')
      .populate('statusHistory.changedBy', 'fullName role')
      .populate('internalNotes.createdBy', 'fullName role');
    if (!application) throw createError('Application not found.', 404);
    res.json({ success: true, data: { application } });
  } catch (error) {
    next(error);
  }
};

export const updateBankApplicationStatus = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateApplicationStatusSchema, req.body);
    const application = await Application.findOne({
      _id: req.params.applicationId,
      bankId: req.user.bankId,
    });
    if (!application) throw createError('Application not found.', 404);

    if (payload.status === 'booked' && application.status === 'cancelled') {
      throw createError('A cancelled application cannot be marked as booked.', 409);
    }
    if (['cancelled', 'expired'].includes(application.status) && payload.status !== application.status) {
      throw createError(`A ${application.status} application cannot be moved to ${payload.status}.`, 409);
    }

    const oldData = application.toObject();
    application.status = payload.status;
    application.statusUpdatedAt = new Date();
    application.statusHistory.push({
      status: payload.status,
      changedBy: req.user._id,
      actorRole: 'bank',
      changedAt: application.statusUpdatedAt,
    });
    if (payload.bankReferenceId) application.bankReferenceId = payload.bankReferenceId;
    if (payload.status === 'booked') application.bankConfirmedAt = new Date();

    await application.save();
    await Notification.create({
      userId: application.userId,
      type: 'application_update',
      title: 'Application status updated',
      message: `Application ${application.referenceCode} is now ${payload.status.replaceAll('_', ' ')}.`,
      relatedEntityType: 'Application',
      relatedEntityId: application._id,
    });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'application.status_updated',
      entityType: 'Application',
      entityId: application._id,
      oldData,
      newData: application.toObject(),
    });

    res.json({
      success: true,
      message: 'Application status updated.',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

export const addBankApplicationNote = async (req, res, next) => {
  try {
    const payload = parseOrThrow(createApplicationNoteSchema, req.body);
    const application = await Application.findOne({
      _id: req.params.applicationId,
      bankId: req.user.bankId,
    }).select('+internalNotes');
    if (!application) throw createError('Application not found.', 404);

    application.internalNotes.push({
      note: payload.note,
      createdBy: req.user._id,
      createdAt: new Date(),
    });
    await application.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'application.internal_note_added',
      entityType: 'Application',
      entityId: application._id,
    });
    res.status(201).json({ success: true, message: 'Internal note added.', data: { application } });
  } catch (error) {
    next(error);
  }
};

export const listBankUsers = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { role: 'bank', bankId: req.user.bankId };
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { users: users.map((user) => user.toJSON()), pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};
