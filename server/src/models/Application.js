import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    referenceCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    fdPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FDPlan', required: true },
    applicantName: { type: String, trim: true, maxlength: 100 },
    applicantPhone: { type: String, trim: true, maxlength: 20 },
    phoneVerifiedAt: { type: Date, default: null },
    dateOfBirth: { type: Date },
    addressLine: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, match: /^\d{6}$/ },
    aadhaarLast4: { type: String, select: false, match: /^\d{4}$/ },
    kycStatus: { type: String, enum: ['not_collected', 'bank_handoff'], default: 'not_collected' },
    depositAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    tenureDays: { type: Number, required: true, min: 1 },
    customerCategory: { type: String, enum: ['standard', 'senior_citizen'], default: 'standard' },
    rateSnapshot: { type: Number, required: true, min: 0 },
    planNameSnapshot: { type: String, required: true, trim: true },
    termsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    estimatedInterest: { type: mongoose.Schema.Types.Decimal128, default: null },
    estimatedMaturityAmount: { type: mongoose.Schema.Types.Decimal128, default: null },
    calculationDisclaimerVersion: { type: String, default: 'v1' },
    consent: {
      dataSharingAccepted: { type: Boolean, required: true, default: false },
      acceptedAt: { type: Date, default: null },
      noticeVersion: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['initiated', 'redirected', 'submitted_to_bank', 'bank_processing', 'booked', 'rejected', 'cancelled', 'expired', 'unknown'],
      default: 'initiated',
    },
    statusHistory: [{
      status: {
        type: String,
        enum: ['initiated', 'redirected', 'submitted_to_bank', 'bank_processing', 'booked', 'rejected', 'cancelled', 'expired', 'unknown'],
        required: true,
      },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      actorRole: { type: String, enum: ['user', 'bank', 'admin'], required: true },
      changedAt: { type: Date, default: Date.now },
    }],
    internalNotes: {
      type: [{
        note: { type: String, required: true, trim: true, maxlength: 2000 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
      select: false,
    },
    bankReferenceId: { type: String, trim: true },
    officialBankRedirectUrl: { type: String, trim: true },
    bankConfirmedAt: { type: Date, default: null },
    statusUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, result) {
        delete result.aadhaarLast4;
        return result;
      },
    },
  }
);

applicationSchema.pre('validate', function () {
  if (this.consent?.dataSharingAccepted && !this.consent.acceptedAt) {
    this.invalidate('consent.acceptedAt', 'acceptedAt is required when consent is granted.');
  }
  if (this.status === 'booked' && !this.bankConfirmedAt) {
    this.invalidate('bankConfirmedAt', 'bankConfirmedAt is required for booked applications.');
  }
});

applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ bankId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ fdPlanId: 1, createdAt: -1 });

export default mongoose.model('Application', applicationSchema);
