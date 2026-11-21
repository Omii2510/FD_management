import mongoose from 'mongoose';

const adCampaignSchema = new mongoose.Schema(
  {
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    campaignName: { type: String, required: true, trim: true, maxlength: 150 },
    campaignType: { type: String, enum: ['fixed_fee', 'cpc', 'cpm'], required: true },
    totalBudget: { type: mongoose.Schema.Types.Decimal128, required: true },
    spentAmount: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending_payment', 'pending_review', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

adCampaignSchema.pre('validate', function () {
  if (this.endAt < this.startAt) {
    this.invalidate('endAt', 'endAt must be after startAt.');
  }
  if (Number(this.totalBudget?.toString()) < 0) {
    this.invalidate('totalBudget', 'totalBudget cannot be negative.');
  }
});

adCampaignSchema.index({ bankId: 1, status: 1 });
adCampaignSchema.index({ startAt: 1, endAt: 1 });

export default mongoose.model('AdCampaign', adCampaignSchema);
