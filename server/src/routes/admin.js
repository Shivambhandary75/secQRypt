const express = require('express');
const User = require('../models/user');
const MerchantVerification = require('../models/merchantVerification');
const MerchantReport = require('../models/merchantReport');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function serializeVerification(record) {
  return {
    id: record._id.toString(),
    merchantAccountId: record.merchantAccountId?.toString?.() || record.merchantAccountId,
    merchantId: record.merchantId,
    merchantName: record.merchantName,
    phoneNumber: record.phoneNumber || '',
    upiId: record.upiId,
    shopLocation: record.shopLocation,
    qrData: record.qrData,
    qrHash: record.qrHash || '',
    govId: record.govId || '',
    verificationStatus: record.verificationStatus,
    riskPoints: record.riskPoints || 0,
    submittedAt: record.submittedAt,
    notes: record.notes || '',
  };
}

function serializeReport(report, verification = null) {
  const status = report.status === 'new' ? 'pending' : report.status === 'reviewing' ? 'on_progress' : report.status;
  return {
    id: report._id.toString(),
    reportedBy: report.reportedBy?.toString?.() || report.reportedBy,
    merchantAccountId: report.merchantAccountId?.toString?.() || report.merchantAccountId || null,
    merchantId: report.merchantId || '',
    merchantName: report.merchantName || '',
    merchantUpiId: report.merchantUpiId || '',
    qrData: report.qrData || '',
    reportReason: report.reportReason,
    details: report.details || '',
    status,
    riskPointsApplied: report.riskPointsApplied || false,
    merchantVerificationStatus: verification?.verificationStatus || 'not_found',
    merchantRiskPoints: verification?.riskPoints || 0,
    merchantPhoneNumber: verification?.phoneNumber || '',
    merchantShopLocation: verification?.shopLocation || '',
    adminNotes: report.adminNotes || '',
    createdAt: report.createdAt,
  };
}

router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const [pendingCount, approvedCount, rejectedCount, openReports] = await Promise.all([
      MerchantVerification.countDocuments({ verificationStatus: 'pending' }),
      MerchantVerification.countDocuments({ verificationStatus: { $in: ['verified', 'approved'] } }),
      MerchantVerification.countDocuments({ verificationStatus: { $in: ['invalid', 'rejected'] } }),
      MerchantReport.countDocuments({ status: { $in: ['pending', 'on_progress', 'new', 'reviewing'] } }),
    ]);

    return res.json({
      overview: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        openReports,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/verification-queue', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const records = await MerchantVerification.find().sort({ createdAt: -1 });
    return res.json({ records: records.map(serializeVerification) });
  } catch (error) {
    return next(error);
  }
});

router.post('/verification/:id/decision', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { decision, notes } = req.body || {};
    if (!['verified', 'invalid'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be verified or invalid' });
    }

    const existingRecord = await MerchantVerification.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ message: 'Verification request not found' });
    }
    if (existingRecord.verificationStatus === 'verified' || existingRecord.verificationStatus === 'approved') {
      return res.status(409).json({ message: 'A verified merchant report cannot be changed.' });
    }

    const record = await MerchantVerification.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          verificationStatus: decision,
          ...(notes ? { notes: String(notes).trim() } : {}),
        },
      },
      { new: true, runValidators: true },
    );

    return res.json({
      message: `Verification report marked ${decision}.`,
      record: serializeVerification(record),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/reports', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const reports = await MerchantReport.find().sort({ createdAt: -1 });
    const verifications = await MerchantVerification.find({
      $or: [
        { merchantAccountId: { $in: reports.map((report) => report.merchantAccountId).filter(Boolean) } },
        { merchantId: { $in: reports.map((report) => report.merchantId).filter(Boolean) } },
      ],
    });
    const verificationByAccount = new Map(verifications.map((record) => [record.merchantAccountId.toString(), record]));
    const verificationByMerchantId = new Map(verifications.map((record) => [record.merchantId, record]));

    return res.json({ reports: reports.map((report) => serializeReport(
      report,
      (report.merchantAccountId && verificationByAccount.get(report.merchantAccountId.toString()))
        || verificationByMerchantId.get(report.merchantId),
    )) });
  } catch (error) {
    return next(error);
  }
});

router.post('/reports/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, notes } = req.body || {};
    const nextStatus = ['pending', 'on_progress', 'resolved', 'dismissed'].includes(status)
      ? status
      : status === 'reviewing'
        ? 'on_progress'
        : status === 'new'
          ? 'pending'
          : 'pending';

    const report = await MerchantReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    report.status = nextStatus;
    report.adminNotes = notes ? String(notes).trim() : report.adminNotes || '';
    await report.save();

    if (nextStatus === 'resolved' && !report.riskPointsApplied && report.merchantAccountId) {
      await MerchantVerification.findOneAndUpdate(
        { merchantAccountId: report.merchantAccountId },
        { $inc: { riskPoints: 1 } },
      );
      report.riskPointsApplied = true;
      await report.save();
    }

    return res.json({
      message: 'Report updated successfully.',
      report: serializeReport(report, await MerchantVerification.findOne({
        $or: [
          { merchantAccountId: report.merchantAccountId },
          { merchantId: report.merchantId },
        ],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
