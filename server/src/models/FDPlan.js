import mongoose from 'mongoose';

const fdPlanSchema = new mongoose.Schema(
  {
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    planName: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true },
    minAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    maxAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      validate: {
        validator: function (value) {
          if (value === null || value === undefined) return true;
          return Number(value.toString()) >= Number(this.minAmount?.toString());
        },
        message: 'maxAmount must be greater than or equal to minAmount.',
      },
    },
    minTenureDays: { type: Number, required: true, min: 1 },
    maxTenureDays: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value >= this.minTenureDays;
        },
        message: 'maxTenureDays must be greater than or equal to minTenureDays.',
      },
    },
    standardInterestRate: { type: Number, required: true, min: 0, max: 20 },
    seniorCitizenInterestRate: { type: Number, min: 0, max: 20, default: null },
    interestPayout: { type: String, enum: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'maturity'], required: true },
    compoundingFrequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'none'],
      default: 'quarterly',
    },
    calculationMethod: { type: String, trim: true },
    prematureWithdrawalAllowed: { type: Boolean, default: false },
    prematureWithdrawalPenaltyDescription: { type: String, trim: true },
    taxSavingEligible: { type: Boolean, default: false },
    eligibilityDescription: { type: String, trim: true },
    termsUrl: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    sourceDocumentUrl: { type: String, trim: true },
    lastVerifiedAt: { type: Date },
    effectiveFrom: { type: Date, required: true },
    effectiveUntil: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          return value === null || value === undefined || value >= this.effectiveFrom;
        },
        message: 'effectiveUntil must be after effectiveFrom.',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected', 'inactive', 'expired'],
      default: 'draft',
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

fdPlanSchema.index({ bankId: 1, status: 1 });
fdPlanSchema.index({ status: 1, effectiveFrom: 1, effectiveUntil: 1 });
fdPlanSchema.index({ standardInterestRate: -1 });
fdPlanSchema.index({ minAmount: 1, maxAmount: 1 });
fdPlanSchema.index({ minTenureDays: 1, maxTenureDays: 1 });

export default mongoose.model('FDPlan', fdPlanSchema);
