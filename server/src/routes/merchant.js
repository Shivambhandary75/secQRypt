const express = require('express');
const crypto = require('crypto');
const User = require('../models/user');
const MerchantVerification = require('../models/merchantVerification');
const MerchantReport = require('../models/merchantReport');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function serializeRecord(record) {
  return {
    id: record._id.toString(),
    merchantId: record.merchantId,
    merchantName: record.merchantName,
    upiId: record.upiId,
    shopLocation: record.shopLocation,
    govId: record.govId,
    qrData: record.qrData,
    qrHash: record.qrHash,
    verificationStatus: record.verificationStatus,
    submittedAt: record.submittedAt,
    notes: record.notes,
  };
}

router.post('/report', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { merchantId, merchantName, upiId, qrData, reportReason, details } = req.body || {};
    const safeReason = ['scam', 'spam', 'mismatch', 'other'].includes(reportReason) ? reportReason : 'spam';

    let relatedMerchantAccount = null;
    if (merchantId) {
      relatedMerchantAccount = await User.findOne({ merchantId: String(merchantId).toUpperCase() });
    }

    const report = await MerchantReport.create({
      reportedBy: user._id,
      merchantAccountId: relatedMerchantAccount?._id || null,
      merchantId: merchantId ? String(merchantId).trim().toUpperCase() : '',
      merchantName: merchantName ? String(merchantName).trim() : '',
      merchantUpiId: upiId ? String(upiId).trim() : '',
      qrData: qrData ? String(qrData).trim() : '',
      reportReason: safeReason,
      details: details ? String(details).trim() : '',
      status: 'new',
    });

    return res.status(201).json({
      message: 'Merchant report submitted successfully.',
      report: {
        id: report._id.toString(),
        merchantId: report.merchantId,
        merchantName: report.merchantName,
        reportReason: report.reportReason,
        details: report.details,
        status: report.status,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'merchant') {
      return res.status(403).json({ message: 'Merchant access required' });
    }

    const record = await MerchantVerification.findOne({ merchantAccountId: user._id }).sort({ createdAt: -1 });
    return res.json({
      status: record ? record.verificationStatus : 'not_applied',
      record: record ? serializeRecord(record) : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'merchant') {
      return res.status(403).json({ message: 'Merchant access required' });
    }

    const { merchantName, upiId, shopLocation, qrData, qrHash, govId, notes } = req.body || {};
    if (!merchantName || !upiId || !shopLocation || !qrData || !qrHash || !govId) {
      return res.status(400).json({ message: 'Merchant name, UPI ID, shop location, government ID, scanned QR data, and QR hash are required' });
    }

    const normalizedQrData = String(qrData).trim();
    const calculatedQrHash = crypto.createHash('sha256').update(normalizedQrData, 'utf8').digest('hex');
    if (String(qrHash).trim().toLowerCase() !== calculatedQrHash) {
      return res.status(400).json({ message: 'QR hash does not match the scanned QR data' });
    }

    const payload = {
      merchantAccountId: user._id,
      merchantId: user.merchantId,
      merchantName: String(merchantName).trim(),
      upiId: String(upiId).trim(),
      shopLocation: String(shopLocation).trim(),
      govId: String(govId).trim(),
      qrData: normalizedQrData,
      qrHash: calculatedQrHash,
      notes: notes ? String(notes).trim() : '',
      verificationStatus: 'pending',
    };

    const existing = await MerchantVerification.findOne({ merchantAccountId: user._id });

    if (existing?.verificationStatus === 'verified' || existing?.verificationStatus === 'approved') {
      return res.status(409).json({ message: 'This merchant is already verified and cannot submit another report.' });
    }

    const record = existing
      ? await MerchantVerification.findByIdAndUpdate(
          existing._id,
          { $set: { ...payload, submittedAt: new Date() } },
          { new: true },
        )
      : await MerchantVerification.create(payload);

    return res.status(201).json({
      message: 'Verification application submitted successfully',
      record: serializeRecord(record),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/application', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'merchant') {
      return res.status(403).json({ message: 'Merchant access required' });
    }

    const record = await MerchantVerification.findOne({ merchantAccountId: user._id });
    if (!record) {
      return res.status(404).json({ message: 'No verification report found' });
    }
    if (record.verificationStatus === 'verified' || record.verificationStatus === 'approved') {
      return res.status(409).json({ message: 'A verified merchant report cannot be removed.' });
    }

    await MerchantVerification.deleteOne({ _id: record._id });
    return res.json({ message: 'Verification report removed successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/qr', async (req, res, next) => {
  try {
    const { qrData, qrHash } = req.body || {};
    if (!qrData) {
      return res.status(400).json({ message: 'QR data is required' });
    }

    const raw = String(qrData).trim();
    const calculatedQrHash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    if (qrHash && String(qrHash).trim().toLowerCase() !== calculatedQrHash) {
      return res.status(400).json({ message: 'QR hash does not match the scanned QR data' });
    }
    let parsed = null;
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    const qrId = parsed?.qrId || parsed?.qr_id || parsed?.merchantId || parsed?.merchant_id || raw;
    const upiId = parsed?.upiId || parsed?.upi_id || parsed?.upi || parsed?.merchantUpi || null;

    const approvedRecords = await MerchantVerification.find({ verificationStatus: { $in: ['verified', 'approved'] } });

    const exactMatch = approvedRecords.find((record) => {
      const recordQr = String(record.qrData || '').trim();
      const recordUpi = String(record.upiId || '').trim();
      const recordHash = String(record.qrHash || '').trim().toLowerCase();
      return recordHash === calculatedQrHash
        || recordQr === raw
        || recordQr === qrId
        || (upiId && recordUpi.toLowerCase() === String(upiId).trim().toLowerCase());
    });

    if (!exactMatch) {
      return res.status(200).json({
        verified: false,
        status: 'not_registered',
        qrHash: calculatedQrHash,
        message: 'This QR is not registered with secQRypt.',
      });
    }

    return res.status(200).json({
      verified: true,
      status: 'VERIFIED',
      qrHash: calculatedQrHash,
      merchantName: exactMatch.merchantName,
      merchantId: exactMatch.merchantId,
      upiId: exactMatch.upiId,
      shopLocation: exactMatch.shopLocation,
      message: 'Verified merchant details matched the registered QR record.',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
