import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['application_update', 'plan_approved', 'plan_rejected', 'bank_verified', 'ad_approved', 'ad_rejected', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    relatedEntityType: { type: String, enum: ['Application', 'FDPlan', 'Bank', 'Advertisement', 'AdCampaign', 'Payment'] },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
