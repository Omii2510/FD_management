import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdCampaign', required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    gateway: { type: String, required: true, trim: true },
    gatewayOrderId: { type: String, trim: true },
    gatewayPaymentId: { type: String, trim: true },
    status: {
      type: String,
      enum: ['created', 'pending', 'success', 'failed', 'refunded'],
      default: 'created',
    },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', function () {
  if (Number(this.amount?.toString()) < 0) {
    this.invalidate('amount', 'amount cannot be negative.');
  }
});

paymentSchema.index({ bankId: 1, status: 1 });
paymentSchema.index({ campaignId: 1 });

export default mongoose.model('Payment', paymentSchema);
