import mongoose from 'mongoose';

const bankSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true, maxlength: 150 },
    bankCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    bankType: {
      type: String,
      enum: ['public', 'private', 'small_finance', 'cooperative', 'other'],
      required: true,
    },
    logoUrl: { type: String },
    description: { type: String, trim: true, maxlength: 3000 },
    officialWebsite: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    customerCare: { type: String, trim: true },
    headquarters: { type: String, trim: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
    },
    verificationNotes: { type: String, select: false },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bankSchema.index({ verificationStatus: 1, isActive: 1 });
bankSchema.index({ bankName: 'text' });

export default mongoose.model('Bank', bankSchema);
