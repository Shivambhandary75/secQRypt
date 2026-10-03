const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['consumer', 'merchant', 'admin'], required: true },
    username: { type: String, trim: true, lowercase: true },
    govId: { type: String, trim: true, uppercase: true },
    merchantId: { type: String, trim: true, uppercase: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ merchantId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);