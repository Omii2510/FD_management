import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. 'bank.approved', 'fdplan.rejected'
    entityType: {
      type: String,
      enum: ['User', 'Bank', 'FDPlan', 'Application', 'Advertisement', 'AdCampaign', 'Payment', 'Favorite', 'Notification'],
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    oldData: { type: mongoose.Schema.Types.Mixed },
    newData: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
