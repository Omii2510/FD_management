import { Bank, AuditLog, User } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import {
  createBankSchema,
  updateBankSchema,
  updateBankStatusSchema,
  updateMyBankSchema,
} from '../validators/bank.validators.js';

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

const cleanBankPayload = (payload) => {
  const cleaned = { ...payload };
  for (const key of ['logoUrl', 'officialWebsite']) {
    if (cleaned[key] === '') cleaned[key] = undefined;
  }
  return cleaned;
};

export const listPublicBanks = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const filter = { verificationStatus: 'approved', isActive: true };
    if (req.query.bankType) filter.bankType = req.query.bankType;
    if (req.query.search) filter.$text = { $search: req.query.search };

    const [banks, total] = await Promise.all([
      Bank.find(filter)
        .sort({ bankName: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Bank.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        banks,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicBank = async (req, res, next) => {
  try {
    const bank = await Bank.findOne({
      _id: req.params.id,
      verificationStatus: 'approved',
      isActive: true,
    });
    if (!bank) throw createError('Approved bank not found.', 404);
    res.json({ success: true, data: { bank } });
  } catch (error) {
    next(error);
  }
};

export const listAllBanks = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const filter = {};
    if (req.query.verificationStatus) filter.verificationStatus = req.query.verificationStatus;
    if (req.query.bankType) filter.bankType = req.query.bankType;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) filter.$text = { $search: req.query.search };

    const [banks, total] = await Promise.all([
      Bank.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Bank.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        banks,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createBank = async (req, res, next) => {
  try {
    const payload = cleanBankPayload(parseOrThrow(createBankSchema, req.body));
    const existing = await Bank.findOne({ bankCode: payload.bankCode.toUpperCase() });
    if (existing) throw createError('A bank with this bank code already exists.', 409);

    const bank = await Bank.create(payload);
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank.created',
      entityType: 'Bank',
      entityId: bank._id,
      newData: bank.toObject(),
    });
    res.status(201).json({ success: true, message: 'Bank created successfully.', data: { bank } });
  } catch (error) {
    if (error.code === 11000) error = createError('A bank with this bank code already exists.', 409);
    next(error);
  }
};

export const updateBank = async (req, res, next) => {
  try {
    const payload = cleanBankPayload(parseOrThrow(updateBankSchema, req.body));
    if (payload.bankCode) payload.bankCode = payload.bankCode.toUpperCase();
    const bank = await Bank.findById(req.params.id);
    if (!bank) throw createError('Bank not found.', 404);

    if (payload.bankCode) {
      const existing = await Bank.findOne({ bankCode: payload.bankCode, _id: { $ne: bank._id } });
      if (existing) throw createError('A bank with this bank code already exists.', 409);
    }

    const oldData = bank.toObject();
    Object.assign(bank, payload);
    await bank.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank.updated',
      entityType: 'Bank',
      entityId: bank._id,
      oldData,
      newData: bank.toObject(),
    });
    res.json({ success: true, message: 'Bank updated successfully.', data: { bank } });
  } catch (error) {
    if (error.code === 11000) error = createError('A bank with this bank code already exists.', 409);
    next(error);
  }
};

export const updateBankStatus = async (req, res, next) => {
  try {
    const payload = parseOrThrow(updateBankStatusSchema, req.body);
    const bank = await Bank.findById(req.params.id);
    if (!bank) throw createError('Bank not found.', 404);

    const oldData = bank.toObject();
    bank.verificationStatus = payload.verificationStatus;
    bank.verificationNotes = payload.verificationNotes;
    if (payload.isActive !== undefined) {
      bank.isActive = payload.isActive;
    } else {
      bank.isActive = payload.verificationStatus === 'approved';
    }
    if (payload.verificationStatus === 'approved') {
      bank.verifiedAt = new Date();
      bank.verifiedBy = req.user._id;
    } else {
      bank.verifiedAt = null;
      bank.verifiedBy = null;
    }
    await bank.save();
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank.verification_updated',
      entityType: 'Bank',
      entityId: bank._id,
      oldData,
      newData: bank.toObject(),
    });
    res.json({ success: true, message: 'Bank verification status updated.', data: { bank } });
  } catch (error) {
    next(error);
  }
};

export const deleteBank = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) throw createError('Bank not found.', 404);
    const oldData = bank.toObject();
    bank.isActive = false;
    bank.verificationStatus = 'suspended';
    await bank.save();
    await User.updateMany({ role: 'bank', bankId: bank._id }, { $set: { isActive: false } });
    await AuditLog.create({
      performedBy: req.user._id,
      action: 'bank.deactivated',
      entityType: 'Bank',
      entityId: bank._id,
      oldData,
      newData: bank.toObject(),
    });
    res.json({ success: true, message: 'Bank deactivated successfully.', data: { bank } });
  } catch (error) {
    next(error);
  }
};

export const getMyBank = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.user.bankId);
    if (!bank) throw createError('Associated bank not found.', 404);
    res.json({ success: true, data: { bank } });
  } catch (error) {
    next(error);
  }
};

export const updateMyBank = async (req, res, next) => {
  try {
    const payload = cleanBankPayload(parseOrThrow(updateMyBankSchema, req.body));
    const bank = await Bank.findById(req.user.bankId);
    if (!bank) throw createError('Associated bank not found.', 404);
    Object.assign(bank, cleanBankPayload(payload));
    await bank.save();
    res.json({ success: true, message: 'Bank profile updated.', data: { bank } });
  } catch (error) {
    next(error);
  }
};
