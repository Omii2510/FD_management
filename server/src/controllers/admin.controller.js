import {
  AdCampaign,
  Advertisement,
  Application,
  AuditLog,
  Bank,
  FDPlan,
  Notification,
  Payment,
  User,
} from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import {
  createManagedBankSchema,
  resetBankUserPasswordSchema,
  updateUserStatusSchema,
} from '../validators/admin.validators.js';

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

export const createManagedBank = async (req, res, next) => {
  try {
    const payload = parseOrThrow(createManagedBankSchema, req.body);
    const existingBank = await Bank.findOne({ bankCode: payload.bank.bankCode.toUpperCase() });
    if (existingBank) throw createError('A bank with this bank code already exists.', 409);
    const existingUser = await User.findOne({ email: payload.bankUser.email });
    if (existingUser) throw createError('An account with this email already exists.', 409);

    const bank = await Bank.create({
      ...payload.bank,
      bankCode: payload.bank.bankCode.toUpperCase(),
      verificationStatus: 'pending',
      isActive: false,
    });

    try {
      const user = await User.create({
        fullName: payload.bankUser.fullName,
        email: payload.bankUser.email,
        passwordHash: payload.bankUser.password,
        authProvider: 'local',
        role: 'bank',
        bankId: bank._id,
        emailVerifiedAt: new Date(),
        isActive: true,
      });
      await AuditLog.create({
        performedBy: req.user._id,
        action: 'bank.created_with_user',
        entityType: 'Bank',
        entityId: bank._id,
        newData: {
          bankName: bank.bankName,
          bankCode: bank.bankCode,
          bankUserEmail: user.email,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Bank registered with a login. Approve the bank before it can access the panel.',
        data: { bank, user: user.toJSON() },
      });
    } catch (error) {
      const rollbackErrors = [];
      try {
        await User.deleteOne({ bankId: bank._id, email: payload.bankUser.email });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      try {
        await Bank.deleteOne({ _id: bank._id });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length) {
        const failure = createError('Bank registration failed and automatic cleanup was incomplete.', 500);
        failure.cause = new AggregateError([error, ...rollbackErrors]);
        return next(failure);
      }
      if (error.code === 11000) {
        return next(createError('An account with this email already exists.', 409));
      }
      return next(error);
    }
  } catch (error) {
    if (error.code === 11000) error = createError('A bank with this bank code already exists.', 409);
    next(error);
  }
};

export const resetBankUserPassword = async (req, res, next) => {
  try {
    const payload = parseOrThrow(resetBankUserPasswordSchema, req.body);
    const user = await User.findOne({ _id: req.params.userId, role: 'bank' });
    if (!user) throw createError('Bank user not found.', 404);

    user.passwordHash = payload.password;
    user.refreshTokenHash = null;
    user.refreshTokenExpires = null;
    await user.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank_user.password_reset',
      entityType: 'User',
      entityId: user._id,
      newData: { email: user.email, bankId: user.bankId },
    });
    res.json({
      success: true,
      message: 'Bank user password reset. Share the temporary password through a secure channel.',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      userCount,
      activeUserCount,
      bankCount,
      activeBankCount,
      pendingBankCount,
      planCount,
      pendingPlanCount,
      applicationCount,
      pendingApplicationCount,
      pendingAdvertisementCount,
      activeAdvertisementCount,
      campaignCount,
      paymentCount,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isActive: true }),
      Bank.countDocuments(),
      Bank.countDocuments({ verificationStatus: 'approved', isActive: true }),
      Bank.countDocuments({ verificationStatus: 'pending' }),
      FDPlan.countDocuments(),
      FDPlan.countDocuments({ status: 'pending_review' }),
      Application.countDocuments(),
      Application.countDocuments({ status: { $in: ['initiated', 'redirected', 'submitted_to_bank', 'bank_processing'] } }),
      Advertisement.countDocuments({ status: 'pending_review' }),
      Advertisement.countDocuments({ status: { $in: ['approved', 'scheduled', 'active'] } }),
      AdCampaign.countDocuments(),
      Payment.countDocuments({ status: 'success' }),
      AuditLog.find().select('action entityType entityId createdAt performedBy').populate('performedBy', 'fullName role').sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      data: {
        users: { total: userCount, active: activeUserCount },
        banks: { total: bankCount, active: activeBankCount, pendingReview: pendingBankCount },
        plans: { total: planCount, pendingReview: pendingPlanCount },
        applications: { total: applicationCount, pending: pendingApplicationCount },
        advertisements: { pendingReview: pendingAdvertisementCount, active: activeAdvertisementCount },
        campaigns: { total: campaignCount },
        successfulPayments: { total: paymentCount },
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listAdminApplications = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.bankId) filter.bankId = req.query.bankId;
    const [applications, total] = await Promise.all([
      Application.find(filter)
        .select('+internalNotes')
        .populate('userId', 'fullName email emailVerifiedAt')
        .populate('bankId', 'bankName bankCode')
        .populate('fdPlanId', 'planName')
        .populate('statusHistory.changedBy', 'fullName role')
        .populate('internalNotes.createdBy', 'fullName role')
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

export const getAdminApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.applicationId)
      .select('+internalNotes')
      .populate('userId', 'fullName email emailVerifiedAt')
      .populate('bankId', 'bankName bankCode')
      .populate('fdPlanId', 'planName')
      .populate('statusHistory.changedBy', 'fullName role')
      .populate('internalNotes.createdBy', 'fullName role');
    if (!application) throw createError('Application not found.', 404);
    res.json({ success: true, data: { application } });
  } catch (error) {
    next(error);
  }
};

export const listAdminUsers = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(filter).populate('bankId', 'bankName bankCode').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        users: users.map((user) => user.toJSON()),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).populate('bankId', 'bankName bankCode');
    if (!user) throw createError('User not found.', 404);
    res.json({ success: true, data: { user: user.toJSON() } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateUserStatusSchema, req.body);
    const user = await User.findById(req.params.userId);
    if (!user) throw createError('User not found.', 404);
    if (user._id.toString() === req.user._id.toString()) {
      throw createError('You cannot change your own account status.', 409);
    }

    const oldData = user.toObject();
    user.isActive = payload.isActive;
    await user.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: payload.isActive ? 'user.activated' : 'user.deactivated',
      entityType: 'User',
      entityId: user._id,
      oldData,
      newData: user.toObject(),
    });
    res.json({
      success: true,
      message: payload.isActive ? 'User activated.' : 'User deactivated.',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

export const listAdminAuditLogs = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.performedBy) filter.performedBy = req.query.performedBy;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('performedBy', 'fullName email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

export const notifyBankVerification = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.params.bankId);
    if (!bank) throw createError('Bank not found.', 404);
    const bankUsers = await User.find({ role: 'bank', bankId: bank._id });
    await Notification.insertMany(bankUsers.map((user) => ({
      userId: user._id,
      type: 'bank_verified',
      title: 'Bank verification updated',
      message: `The verification status of ${bank.bankName} is ${bank.verificationStatus}.`,
      relatedEntityType: 'Bank',
      relatedEntityId: bank._id,
    })));
    res.json({ success: true, message: 'Bank users notified.', data: { notifiedUsers: bankUsers.length } });
  } catch (error) {
    next(error);
  }
};
