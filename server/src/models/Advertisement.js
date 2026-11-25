import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema(
  {
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    fdPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FDPlan', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    bannerImageUrl: { type: String, required: true },
    destinationUrl: { type: String, required: true },
    proposedBudget: { type: mongoose.Schema.Types.Decimal128, min: 0 },
    campaignObjective: {
      type: String,
      enum: ['brand_awareness', 'plan_enquiries', 'website_traffic', 'other'],
    },
    objectiveDetails: { type: String, trim: true, maxlength: 2000 },
    placement: {
      type: String,
      enum: ['homepage_banner', 'featured_fd', 'sponsored_search', 'sidebar'],
      required: true,
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected', 'scheduled', 'active', 'paused', 'expired'],
      default: 'draft',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    impressionCount: { type: Number, default: 0, min: 0 },
    clickCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

advertisementSchema.pre('validate', function () {
  if (this.endAt < this.startAt) {
    this.invalidate('endAt', 'endAt must be after startAt.');
  }
});

advertisementSchema.index({ status: 1, startAt: 1, endAt: 1 });
advertisementSchema.index({ bankId: 1, createdAt: -1 });
advertisementSchema.index({ placement: 1, status: 1 });

export default mongoose.model('Advertisement', advertisementSchema);
