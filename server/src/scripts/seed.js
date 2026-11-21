import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import {
  User,
  Bank,
  FDPlan,
  Application,
  Advertisement,
  AdCampaign,
  Payment,
  Favorite,
  Notification,
  AuditLog,
  AdEvent,
} from '../models/index.js';

const seed = async () => {
  await connectDB();

  const admin = await User.findOneAndUpdate(
    { email: 'fictional.admin@fdconnect.test' },
    {
      fullName: 'Fictional Admin',
      authProvider: 'local',
      role: 'admin',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const bank = await Bank.findOneAndUpdate(
    { bankCode: 'FDTEST01' },
    {
      bankName: 'FD Connect Fictional Bank',
      bankType: 'private',
      description: 'Clearly fictional seed bank for local development.',
      officialWebsite: 'https://example.com',
      customerCare: '+91-00000-00000',
      headquarters: 'Test City',
      verificationStatus: 'approved',
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: admin._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const bankUser = await User.findOneAndUpdate(
    { email: 'fictional.bank@fdconnect.test' },
    {
      fullName: 'Fictional Bank Manager',
      authProvider: 'local',
      role: 'bank',
      bankId: bank._id,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const user = await User.findOneAndUpdate(
    { email: 'fictional.user@fdconnect.test' },
    {
      fullName: 'Fictional FD User',
      authProvider: 'local',
      role: 'user',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const plan = await FDPlan.findOneAndUpdate(
    { bankId: bank._id, planName: 'Fictional 12-Month FD' },
    {
      description: 'Seed-only fixed deposit plan.',
      minAmount: mongoose.Types.Decimal128.fromString('1000'),
      maxAmount: mongoose.Types.Decimal128.fromString('1000000'),
      minTenureDays: 30,
      maxTenureDays: 365,
      standardInterestRate: 7.25,
      seniorCitizenInterestRate: 7.75,
      interestPayout: 'maturity',
      compoundingFrequency: 'quarterly',
      calculationMethod: 'quarterly_compounding',
      prematureWithdrawalAllowed: true,
      prematureWithdrawalPenaltyDescription: 'Fictional test penalty.',
      taxSavingEligible: false,
      eligibilityDescription: 'Seed data only.',
      sourceUrl: 'https://example.com/fd-rates',
      lastVerifiedAt: new Date(),
      effectiveFrom: new Date(),
      status: 'approved',
      submittedBy: bankUser._id,
      reviewedBy: admin._id,
      reviewedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const application = await Application.findOneAndUpdate(
    { referenceCode: 'FDC-SEED-0001' },
    {
      userId: user._id,
      bankId: bank._id,
      fdPlanId: plan._id,
      depositAmount: mongoose.Types.Decimal128.fromString('50000'),
      tenureDays: 365,
      customerCategory: 'standard',
      rateSnapshot: 7.25,
      planNameSnapshot: plan.planName,
      termsSnapshot: { source: 'fictional seed data' },
      estimatedInterest: mongoose.Types.Decimal128.fromString('3625'),
      estimatedMaturityAmount: mongoose.Types.Decimal128.fromString('53625'),
      consent: {
        dataSharingAccepted: true,
        acceptedAt: new Date(),
        noticeVersion: 'v1',
      },
      status: 'initiated',
      officialBankRedirectUrl: 'https://example.com/apply',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const campaign = await AdCampaign.findOneAndUpdate(
    { bankId: bank._id, campaignName: 'Fictional Test Campaign' },
    {
      campaignType: 'fixed_fee',
      totalBudget: mongoose.Types.Decimal128.fromString('1000'),
      spentAmount: mongoose.Types.Decimal128.fromString('0'),
      currency: 'INR',
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending_review',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const advertisement = await Advertisement.findOneAndUpdate(
    { bankId: bank._id, title: 'Fictional Featured FD' },
    {
      fdPlanId: plan._id,
      description: 'Seed-only sponsored placement.',
      bannerImageUrl: 'https://example.com/banner.png',
      destinationUrl: 'https://example.com/fd',
      placement: 'featured_fd',
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending_review',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Payment.findOneAndUpdate(
    { bankId: bank._id, gatewayOrderId: 'FDC-SEED-ORDER-001' },
    {
      campaignId: campaign._id,
      amount: mongoose.Types.Decimal128.fromString('1000'),
      currency: 'INR',
      gateway: 'manual',
      gatewayPaymentId: 'FDC-SEED-PAYMENT-001',
      status: 'created',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Favorite.findOneAndUpdate(
    { userId: user._id, fdPlanId: plan._id },
    {},
    { upsert: true, setDefaultsOnInsert: true }
  );

  await Notification.create({
    userId: user._id,
    type: 'application_update',
    title: 'Fictional application update',
    message: 'Your fictional seed application was initiated.',
    relatedEntityType: 'Application',
    relatedEntityId: application._id,
  });

  await AuditLog.create({
    performedBy: admin._id,
    action: 'seed.created',
    entityType: 'FDPlan',
    entityId: plan._id,
    newData: { source: 'fictional seed data' },
  });

  await AdEvent.findOneAndUpdate(
    {
      advertisementId: advertisement._id,
      anonymousSessionId: 'fictional-seed-session',
      eventType: 'impression',
    },
    {
      campaignId: campaign._id,
      bankId: bank._id,
      occurredAt: new Date(),
      placement: 'featured_fd',
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  console.log('Seeded clearly fictional FD Connect test data.');
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error('Seeding failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
