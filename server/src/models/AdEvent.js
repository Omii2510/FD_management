import mongoose from 'mongoose';

const adEventSchema = new mongoose.Schema(
  {
    advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdCampaign', default: null },
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    eventType: { type: String, enum: ['impression', 'click'], required: true },
    occurredAt: { type: Date, default: Date.now },
    anonymousSessionId: { type: String, trim: true, select: false },
    placement: { type: String, enum: ['homepage_banner', 'featured_fd', 'sponsored_search', 'sidebar'] },
  },
  {
    timestamps: false,
  }
);

adEventSchema.index({ advertisementId: 1, eventType: 1, occurredAt: -1 });
adEventSchema.index({ campaignId: 1, eventType: 1, occurredAt: -1 });
adEventSchema.index({ occurredAt: -1 });

export default mongoose.model('AdEvent', adEventSchema);
