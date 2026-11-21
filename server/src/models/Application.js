import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    referenceCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    fdPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FDPlan', required: true },
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
    bankReferenceId: { type: String, trim: true },
    officialBankRedirectUrl: { type: String, trim: true },
    bankConfirmedAt: { type: Date, default: null },
    statusUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
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
