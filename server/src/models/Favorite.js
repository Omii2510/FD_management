import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fdPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FDPlan', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate favourites for the same user + plan
favoriteSchema.index({ userId: 1, fdPlanId: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);
