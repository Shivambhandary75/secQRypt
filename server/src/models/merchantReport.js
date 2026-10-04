const mongoose = require('mongoose');

const merchantReportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    merchantId: { type: String, trim: true, uppercase: true, default: '' },
    merchantName: { type: String, trim: true, default: '' },
    merchantUpiId: { type: String, trim: true, default: '' },
    qrData: { type: String, trim: true, default: '' },
    reportReason: {
      type: String,
      enum: ['scam', 'spam', 'mismatch', 'other'],
      default: 'spam',
      index: true,
    },
    details: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'on_progress', 'resolved', 'dismissed', 'new', 'reviewing'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, trim: true, default: '' },
    riskPointsApplied: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('MerchantReport', merchantReportSchema);
