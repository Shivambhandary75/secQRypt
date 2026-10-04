const mongoose = require('mongoose');

const merchantVerificationSchema = new mongoose.Schema(
  {
    merchantAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantId: { type: String, required: true, trim: true, uppercase: true },
    merchantName: { type: String, required: true, trim: true },
    upiId: { type: String, required: true, trim: true },
    shopLocation: { type: String, required: true, trim: true },
    govId: { type: String, trim: true },
    qrData: { type: String, required: true, trim: true },
    qrHash: { type: String, trim: true, lowercase: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'invalid', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

merchantVerificationSchema.index({ merchantId: 1 }, { unique: true });
merchantVerificationSchema.index({ qrData: 1 }, { unique: true });
merchantVerificationSchema.index({ qrHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('MerchantVerification', merchantVerificationSchema);
