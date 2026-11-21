import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, minlength: 8, select: false },
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], required: true, default: 'local' },
    role: { type: String, enum: ['user', 'bank', 'admin'], required: true, default: 'user' },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      default: null,
      validate: {
        validator: function (value) {
          return this.role !== 'bank' || Boolean(value);
        },
        message: 'Bank role requires an associated bank.',
      },
    },
    profileImage: { type: String },
    emailVerifiedAt: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash') || !this.passwordHash) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.googleId;
  return obj;
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ bankId: 1 });

export default mongoose.model('User', userSchema);
