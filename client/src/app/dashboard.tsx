import { useLocalSearchParams, useRouter } from 'expo-router';
import { LogOut, QrCode, Search, ShieldCheck, Store, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { decideVerification, getAdminOverview, getMerchantReports, getVerificationQueue, resolveMerchantReport } from '@/services/admin';
import { getSession, getToken, logout, type AuthUser } from '@/services/auth';
import { findMerchantByLookup, getMerchantStatus, getMyMerchantReports, removeMerchantVerification, submitMerchantReport, type ConsumerReport, type MerchantReportReason, type MerchantVerificationRecord, type MerchantVerificationStatus } from '@/services/merchant';
import { getScanHistory, type ScanHistoryItem } from '@/services/history';

export default function DashboardScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<MerchantVerificationStatus>('not_applied');
  const [verificationRecord, setVerificationRecord] = useState<MerchantVerificationRecord | null>(null);
  const [adminOverview, setAdminOverview] = useState({ pending: 0, approved: 0, rejected: 0, openReports: 0 });
  const [adminQueue, setAdminQueue] = useState<any[]>([]);
  const [adminReports, setAdminReports] = useState<any[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [adminActionError, setAdminActionError] = useState('');
  const [merchantActionError, setMerchantActionError] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [consumerReports, setConsumerReports] = useState<ConsumerReport[]>([]);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [merchantSearchLoading, setMerchantSearchLoading] = useState(false);
  const [merchantSearchError, setMerchantSearchError] = useState('');
  const [merchantSearchResult, setMerchantSearchResult] = useState<null | {
    found: boolean;
    status: string;
    message: string;
    merchantName?: string;
    merchantId?: string;
    phoneNumber?: string;
    upiId?: string;
    shopLocation?: string;
    riskPoints?: number;
  }>(null);
  const [searchReporting, setSearchReporting] = useState(false);
  const [searchReportReason, setSearchReportReason] = useState<MerchantReportReason>('spam');
  const [searchReportDetails, setSearchReportDetails] = useState('');
  const [searchReportStatus, setSearchReportStatus] = useState('');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Exit secQRypt?', 'Do you want to exit the app?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session) {
        const requestedRole = role === 'merchant' ? 'merchant' : role === 'admin' ? 'admin' : 'consumer';
        router.replace(`/auth?role=${requestedRole}&mode=login`);
        return;
      }

      setUser(session);

      if (session.role === 'consumer') {
        const [scans, reports] = await Promise.all([
          getScanHistory(session.id),
          getMyMerchantReports(),
        ]);
        setScanHistory(scans);
        setConsumerReports(reports.reports || []);
      }

      if (session.role === 'merchant') {
        try {
          const result = await getMerchantStatus();
          setVerificationStatus(result.status);
          setVerificationRecord(result.record);
        } catch {
          setVerificationStatus('not_applied');
          setVerificationRecord(null);
        }
      }

      if (session.role === 'admin') {
        try {
          const token = await getToken();
          if (token) {
            const [overviewResult, queueResult, reportsResult] = await Promise.all([
              getAdminOverview(token),
              getVerificationQueue(token),
              getMerchantReports(token),
            ]);

            setAdminOverview(overviewResult.overview);
            setAdminQueue(queueResult.records || []);
            setAdminReports(reportsResult.reports || []);
          }
        } catch {
          setAdminOverview({ pending: 0, approved: 0, rejected: 0, openReports: 0 });
          setAdminQueue([]);
          setAdminReports([]);
        }
      }

      setCheckingSession(false);
    });
  }, [role, router]);

  async function handleMerchantDecision(id: string, decision: 'verified' | 'invalid') {
    try {
      setAdminActionError('');
      const token = await getToken();
      if (!token) return;

      const response = await decideVerification(token, id, decision, decision === 'verified' ? 'Verified by government review.' : 'Marked invalid by government review.');
      setAdminQueue((records) => records.map((record) => (record.id === response.record.id ? response.record : record)));

      const overview = await getAdminOverview(token);
      setAdminOverview(overview.overview);
    } catch (error) {
      setAdminActionError(error instanceof Error ? error.message : 'Unable to update the merchant request.');
    }
  }

  async function handleRemoveMerchantReport() {
    try {
      setMerchantActionError('');
      await removeMerchantVerification();
      setVerificationStatus('not_applied');
      setVerificationRecord(null);
    } catch (error) {
      setMerchantActionError(error instanceof Error ? error.message : 'Unable to remove the verification report.');
    }
  }

  async function handleReportResolution(id: string, status: 'pending' | 'on_progress' | 'resolved' | 'dismissed') {
    const token = await getToken();
    if (!token) return;

    const notes = status === 'resolved'
      ? 'Report resolved by government review.'
      : status === 'on_progress'
        ? 'Report is under government investigation.'
        : status === 'pending'
          ? 'Report is pending government review.'
          : 'Report dismissed by government review.';
    const response = await resolveMerchantReport(token, id, status, notes);
    setAdminReports((reports) => reports.map((report) => (report.id === response.report.id ? response.report : report)));

    const overview = await getAdminOverview(token);
    setAdminOverview(overview.overview);
    const queue = await getVerificationQueue(token);
    setAdminQueue(queue.records || []);
  }

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    router.replace('/role-selection');
  }

  async function handleMerchantSearch() {
    const search = merchantSearch.trim();
    setMerchantSearchError('');
    setMerchantSearchResult(null);
    setSearchReporting(false);
    setSearchReportDetails('');
    setSearchReportStatus('');

    if (!search || (search.includes('@') === false && search.replace(/\D/g, '').length < 7)) {
      setMerchantSearchError('Enter a valid merchant phone number or UPI ID.');
      return;
    }

    setMerchantSearchLoading(true);
    try {
      setMerchantSearchResult(await findMerchantByLookup(search));
    } catch (error) {
      setMerchantSearchError(error instanceof Error ? error.message : 'Unable to search for this merchant.');
    } finally {
      setMerchantSearchLoading(false);
    }
  }

  async function handleSearchReport() {
    if (!merchantSearchResult) return;

    try {
      const searchedIdentifier = merchantSearch.trim();
      const reportDetails = searchReportDetails.trim();
      const response = await submitMerchantReport({
        merchantId: merchantSearchResult.merchantId,
        merchantName: merchantSearchResult.merchantName || 'Unidentified merchant',
        upiId: merchantSearchResult.upiId || (searchedIdentifier.includes('@') ? searchedIdentifier : undefined),
        reportReason: searchReportReason,
        details: `Lookup value: ${searchedIdentifier}${reportDetails ? `\n${reportDetails}` : ''}`,
      });
      setSearchReportStatus(response.message || 'Report submitted successfully.');
      setSearchReporting(false);
      setSearchReportDetails('');
      const session = await getSession();
      if (session) setConsumerReports((await getMyMerchantReports()).reports || []);
    } catch (error) {
      setSearchReportStatus(error instanceof Error ? error.message : 'Unable to submit report.');
    }
  }

  if (checkingSession) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!user) return null;

  const isMerchant = user.role === 'merchant';
  const isAdmin = user.role === 'admin';
  const isVerified = verificationStatus === 'verified' || verificationStatus === 'approved';

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="mx-auto w-full max-w-3xl flex-1">
        <ScrollView className="flex-1" contentContainerClassName="p-7">
        <View className="mt-3 flex-row items-center justify-between">
          <View>
              <Text className="text-[10px] font-extrabold tracking-[2px] text-white">
                {isMerchant ? 'MERCHANT WORKSPACE' : isAdmin ? 'ADMIN WORKSPACE' : 'PERSONAL WORKSPACE'}
            </Text>
            <Text className="mt-2 text-[31px] font-extrabold text-white">Good to see you.</Text>
          </View>

          <View className="relative">
            <Pressable
              onPress={() => setMenuOpen((open) => !open)}
              className="h-12 w-12 items-center justify-center rounded-full bg-white"
            >
              {isMerchant ? <Store size={21} color="#000000" /> : isAdmin ? <ShieldCheck size={21} color="#000000" /> : <UserRound size={21} color="#000000" />}
            </Pressable>

            {menuOpen && (
              <View style={{ position: 'absolute', right: 0, top: 58, width: 176, zIndex: 1000, elevation: 20 }} className="rounded-xl border border-white bg-black p-2 shadow-lg">
                <Pressable onPress={handleLogout} className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 py-2 active:opacity-80">
                  <LogOut size={19} color="#f87171" />
                  <Text className="flex-1 text-sm font-semibold text-red-400">Log out</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {isMerchant && (
          <View className="mt-7 rounded-xl border border-white bg-black p-5">
            <Text className="text-[10px] font-extrabold tracking-[1px] text-white/70">VERIFICATION STATUS</Text>
            {merchantActionError ? <Text className="mt-3 rounded-lg bg-red-950 p-3 text-sm text-red-200">{merchantActionError}</Text> : null}
            <Text className="mt-3 text-[26px] font-extrabold text-white">
              {isVerified
                ? 'Verified merchant'
                : verificationStatus === 'pending'
                  ? 'Verification Pending'
                  : verificationStatus === 'invalid' || verificationStatus === 'rejected'
                    ? 'Report marked invalid'
                    : 'Not Verified'}
            </Text>

            {isVerified && <Text className="mt-2 text-sm font-extrabold text-green-400">Verified by government review</Text>}

            {verificationRecord && (
              <View className="mt-3 gap-1">
                <Text className="text-sm text-white/80">Merchant: {verificationRecord.merchantName}</Text>
                <Text className="text-sm text-white/80">UPI: {verificationRecord.upiId}</Text>
                <Text className="text-sm text-white/80">Location: {verificationRecord.shopLocation}</Text>
              </View>
            )}

            {!isVerified && (
              <>
                <Pressable
                  onPress={() => router.push('/merchant-verification?role=merchant')}
                  className="mt-5 rounded-xl border border-white bg-white px-4 py-3"
                >
                  <Text className="text-center text-sm font-extrabold text-black">
                    {verificationStatus === 'pending' ? 'View Verification Report' : verificationStatus === 'invalid' || verificationStatus === 'rejected' ? 'Submit New Report' : 'Submit Verification Report'}
                  </Text>
                </Pressable>
                {verificationRecord && !isVerified && (
                  <Pressable onPress={handleRemoveMerchantReport} className="mt-3 items-center border border-red-400 px-4 py-3">
                    <Text className="text-sm font-extrabold text-red-400">Remove Report</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {isAdmin && (
          <View className="mt-7 gap-5 rounded-xl border border-white bg-black p-5">
            <Text className="text-[10px] font-extrabold tracking-[1px] text-white/70">ADMIN REVIEW</Text>
            {adminActionError ? <Text className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{adminActionError}</Text> : null}

            <View className="flex-row gap-2">
              <View className="flex-1 rounded-lg border border-white bg-white p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-black/70">Pending</Text>
                <Text className="mt-2 text-2xl font-extrabold text-black">{adminOverview.pending}</Text>
              </View>
              <View className="flex-1 rounded-lg border border-white bg-white p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-black/70">Open reports</Text>
                <Text className="mt-2 text-2xl font-extrabold text-black">{adminOverview.openReports}</Text>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm font-extrabold text-white">Merchant verification queue</Text>
              {adminQueue.length === 0 ? (
                <Text className="text-sm text-white/70">No merchant requests are waiting review.</Text>
              ) : (
                adminQueue.map((record) => (
                  <View key={record.id} className="mb-3 rounded-lg border border-white bg-white p-3">
                    <Text className="text-sm font-extrabold text-black">{record.merchantName}</Text>
                    <Text className={`text-xs font-extrabold ${record.verificationStatus === 'verified' || record.verificationStatus === 'approved' ? 'text-green-700' : record.verificationStatus === 'invalid' || record.verificationStatus === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                      Status: {record.verificationStatus === 'approved' ? 'verified' : record.verificationStatus === 'rejected' ? 'invalid' : record.verificationStatus}
                    </Text>
                    <Text className="text-xs text-black/70">Merchant ID: {record.merchantId}</Text>
                    <Text className="text-xs text-black/70">Phone: {record.phoneNumber}</Text>
                    <Text className="text-xs text-black/70">UPI: {record.upiId}</Text>
                    <Text className="text-xs text-black/70">Gov ID: {record.govId}</Text>
                    <Text className="text-xs text-black/70">QR: {record.qrData}</Text>
                    <Text className="mt-1 font-mono text-[10px] leading-4 text-black/70">SHA-256: {record.qrHash || 'Not available for this older request'}</Text>
                    <Text className="mt-1 text-xs font-extrabold text-red-700">Government risk points: {record.riskPoints || 0}</Text>
                    {record.verificationStatus === 'pending' && (
                      <View className="mt-3 flex-row gap-2">
                        <Pressable onPress={() => handleMerchantDecision(record.id, 'verified')} className="flex-1 rounded-lg bg-green-600 px-2 py-2">
                          <Text className="text-center text-xs font-extrabold text-white">Verify</Text>
                        </Pressable>
                        <Pressable onPress={() => handleMerchantDecision(record.id, 'invalid')} className="flex-1 rounded-lg bg-red-600 px-2 py-2">
                          <Text className="text-center text-xs font-extrabold text-white">Mark invalid</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            <View>
              <Text className="mb-2 text-sm font-extrabold text-white">Consumer reports</Text>
              {adminReports.length === 0 ? (
                <Text className="text-sm text-white/70">No consumer reports are pending.</Text>
              ) : (
                adminReports.map((report) => (
                  <View key={report.id} className="mb-3 rounded-lg border border-white bg-black p-3">
                    <Text className="text-sm font-extrabold text-white">{report.reportReason.toUpperCase()} - {report.merchantName || report.merchantId || 'Unidentified merchant'}</Text>
                    <Text className="text-xs text-white/70">{report.details || 'No additional comments provided.'}</Text>
                    {report.riskPointsApplied ? <Text className="mt-2 text-xs font-extrabold text-red-300">Risk point applied to merchant</Text> : null}
                    <Pressable onPress={() => setExpandedReportId((id) => id === report.id ? null : report.id)} className="mt-3 border border-white px-3 py-2">
                      <Text className="text-center text-xs font-extrabold text-white">{expandedReportId === report.id ? 'Hide report details' : 'View report details'}</Text>
                    </Pressable>
                    {expandedReportId === report.id && (
                      <View className="mt-3 gap-1 border border-white/30 bg-white/5 p-3">
                        <Text className="text-[10px] font-extrabold tracking-wider text-white/60">CUSTOMER REPORT DETAILS</Text>
                        <Text className={`mt-2 text-sm font-extrabold ${report.merchantVerificationStatus === 'verified' || report.merchantVerificationStatus === 'approved' ? 'text-green-300' : 'text-amber-300'}`}>
                          Merchant verification: {report.merchantVerificationStatus === 'not_found' ? 'No verification record' : report.merchantVerificationStatus}
                        </Text>
                        {report.merchantVerificationStatus === 'verified' || report.merchantVerificationStatus === 'approved' ? (
                          <Text className="text-xs font-extrabold text-amber-300">This customer reported a merchant that was already verified.</Text>
                        ) : null}
                        <Text className="mt-2 text-xs text-white/75">Report ID: {report.id}</Text>
                        <Text className="text-xs text-white/75">Customer account: {report.reportedBy}</Text>
                        <Text className="text-xs text-white/75">Merchant ID: {report.merchantId || 'Not provided'}</Text>
                        <Text className="text-xs text-white/75">Phone: {report.merchantPhoneNumber || 'Not available'}</Text>
                        <Text className="text-xs text-white/75">UPI ID: {report.merchantUpiId || 'Not provided'}</Text>
                        <Text className="text-xs text-white/75">Location: {report.merchantShopLocation || 'Not available'}</Text>
                        <Text className="text-xs text-white/75">QR data: {report.qrData || 'Not provided'}</Text>
                        <Text className="text-xs text-white/75">Merchant risk points: {report.merchantRiskPoints || 0}</Text>
                        <Text className="text-xs text-white/75">Submitted: {report.createdAt ? formatHistoryDate(report.createdAt) : 'Unknown'}</Text>
                        <Text className="text-xs text-white/75">Current status: {report.status}</Text>
                        {report.adminNotes ? <Text className="mt-2 text-xs text-white/90">Government notes: {report.adminNotes}</Text> : null}
                      </View>
                    )}
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <Pressable onPress={() => handleReportResolution(report.id, 'pending')} className={`rounded-lg border px-3 py-2 ${report.status === 'pending' ? 'bg-amber-400' : 'border-white'}`}>
                        <Text className={`text-center text-xs font-extrabold ${report.status === 'pending' ? 'text-black' : 'text-white'}`}>Pending</Text>
                      </Pressable>
                      <Pressable onPress={() => handleReportResolution(report.id, 'on_progress')} className={`rounded-lg border px-3 py-2 ${report.status === 'on_progress' ? 'bg-blue-400' : 'border-white'}`}>
                        <Text className={`text-center text-xs font-extrabold ${report.status === 'on_progress' ? 'text-black' : 'text-white'}`}>On progress</Text>
                      </Pressable>
                      <Pressable onPress={() => handleReportResolution(report.id, 'resolved')} className={`rounded-lg border px-3 py-2 ${report.status === 'resolved' ? 'bg-green-400' : 'border-white'}`}>
                        <Text className={`text-center text-xs font-extrabold ${report.status === 'resolved' ? 'text-black' : 'text-white'}`}>Resolved</Text>
                      </Pressable>
                      <Pressable onPress={() => handleReportResolution(report.id, 'dismissed')} className={`rounded-lg border px-3 py-2 ${report.status === 'dismissed' ? 'bg-red-400' : 'border-white'}`}>
                        <Text className={`text-center text-xs font-extrabold ${report.status === 'dismissed' ? 'text-black' : 'text-white'}`}>Dismissed</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {!isMerchant && !isAdmin && (
          <>
            <Text className="mb-3 mt-7 text-lg font-extrabold text-white">Scan before paying</Text>
            <DashboardAction icon={QrCode} label="Scan QR" onPress={() => router.push('/scanner')} />

            <View className="mt-5 rounded-xl border border-white bg-black p-4">
              <View className="flex-row items-center gap-2">
                <Search size={18} color="#FFFFFF" />
                <Text className="text-sm font-extrabold text-white">Find a verified merchant</Text>
              </View>
              <Text className="mt-2 text-sm leading-5 text-white/65">Search by merchant phone number or UPI ID to view the same details shown after a QR scan.</Text>
              <View className="mt-3 flex-row gap-2">
                <TextInput
                  value={merchantSearch}
                  onChangeText={setMerchantSearch}
                  placeholder="Phone number or UPI ID"
                  placeholderTextColor="#777777"
                  keyboardType="phone-pad"
                  className="min-h-12 flex-1 rounded-lg border border-white bg-black px-3 py-2 text-white"
                />
                <Pressable onPress={handleMerchantSearch} disabled={merchantSearchLoading} className="min-h-12 items-center justify-center bg-white px-4">
                  {merchantSearchLoading ? <ActivityIndicator color="#000000" /> : <Text className="text-sm font-extrabold text-black">Search</Text>}
                </Pressable>
              </View>
              {merchantSearchError ? <Text className="mt-3 text-sm text-red-400">{merchantSearchError}</Text> : null}
              {merchantSearchResult ? (
                <View className={`mt-4 rounded-lg border p-4 ${merchantSearchResult.found ? 'border-green-400 bg-green-950/30' : 'border-red-400 bg-red-950/30'}`}>
                  <Text className={`text-sm font-extrabold ${merchantSearchResult.found ? 'text-green-300' : 'text-red-300'}`}>
                    {merchantSearchResult.found ? 'Verified merchant' : 'Merchant not found'}
                  </Text>
                  {merchantSearchResult.found ? (
                    <View className="mt-2 gap-1">
                      <Text className="text-xl font-extrabold text-white">{merchantSearchResult.merchantName}</Text>
                      <Text className="text-sm text-white/75">Merchant ID: {merchantSearchResult.merchantId}</Text>
                      <Text className="text-sm text-white/75">Phone: {merchantSearchResult.phoneNumber}</Text>
                      <Text className="text-sm text-white/75">UPI ID: {merchantSearchResult.upiId}</Text>
                      <Text className="text-sm text-white/75">Location: {merchantSearchResult.shopLocation}</Text>
                      <Text className="mt-2 text-sm font-extrabold text-green-300">Status: {merchantSearchResult.status}</Text>
                      <Text className={`mt-2 text-sm font-extrabold ${merchantSearchResult.riskPoints ? 'text-red-300' : 'text-green-300'}`}>
                        Government risk points: {merchantSearchResult.riskPoints || 0}
                      </Text>
                      <Pressable onPress={() => setSearchReporting((value) => !value)} className="mt-3 items-center bg-red-500 py-3">
                        <Text className="text-sm font-extrabold text-white">{searchReporting ? 'Hide report form' : 'Report this merchant'}</Text>
                      </Pressable>
                      {searchReporting && (
                        <View className="mt-3 gap-3">
                          <Text className="text-xs font-bold uppercase tracking-wider text-white">Report reason</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {(['spam', 'scam', 'mismatch', 'other'] as const).map((value) => (
                              <Pressable key={value} onPress={() => setSearchReportReason(value)} className={`rounded-full border px-3 py-2 ${searchReportReason === value ? 'border-white bg-white' : 'border-white bg-black'}`}>
                                <Text className={`text-xs font-bold ${searchReportReason === value ? 'text-black' : 'text-white'}`}>{value.toUpperCase()}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput value={searchReportDetails} onChangeText={setSearchReportDetails} placeholder="Explain why this merchant should be reviewed." placeholderTextColor="#777777" multiline className="min-h-[80px] rounded-lg border border-white bg-black px-3 py-3 text-white" />
                          <Pressable onPress={handleSearchReport} className="items-center bg-white py-3">
                            <Text className="text-sm font-extrabold text-black">Submit report</Text>
                          </Pressable>
                        </View>
                      )}
                      {searchReportStatus ? <Text className="mt-3 text-xs text-white/80">{searchReportStatus}</Text> : null}
                    </View>
                  ) : (
                    <View className="mt-2 gap-3">
                      <Text className="text-sm text-white/80">{merchantSearchResult.message}</Text>
                      <Pressable onPress={() => setSearchReporting((value) => !value)} className="items-center bg-red-500 py-3">
                        <Text className="text-sm font-extrabold text-white">{searchReporting ? 'Hide report form' : 'Report this merchant'}</Text>
                      </Pressable>
                      {searchReporting && (
                        <View className="gap-3">
                          <Text className="text-xs font-bold uppercase tracking-wider text-white">Report reason</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {(['spam', 'scam', 'mismatch', 'other'] as const).map((value) => (
                              <Pressable key={value} onPress={() => setSearchReportReason(value)} className={`rounded-full border px-3 py-2 ${searchReportReason === value ? 'border-white bg-white' : 'border-white bg-black'}`}>
                                <Text className={`text-xs font-bold ${searchReportReason === value ? 'text-black' : 'text-white'}`}>{value.toUpperCase()}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput value={searchReportDetails} onChangeText={setSearchReportDetails} placeholder="Explain why this merchant should be reviewed." placeholderTextColor="#777777" multiline className="min-h-[80px] rounded-lg border border-white bg-black px-3 py-3 text-white" />
                          <Pressable onPress={handleSearchReport} className="items-center bg-white py-3">
                            <Text className="text-sm font-extrabold text-black">Submit report</Text>
                          </Pressable>
                        </View>
                      )}
                      {searchReportStatus ? <Text className="text-xs text-white/80">{searchReportStatus}</Text> : null}
                    </View>
                  )}
                </View>
              ) : null}
            </View>

            <Text className="mb-3 mt-8 text-lg font-extrabold text-white">Scan history</Text>
            {scanHistory.length === 0 ? (
              <Text className="text-sm text-white/60">Your QR checks will appear here.</Text>
            ) : scanHistory.map((scan) => (
              <View key={scan.id} className="mb-3 rounded-xl border border-white bg-black p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className={`text-sm font-extrabold ${scan.verified ? 'text-green-400' : 'text-red-400'}`}>
                    {scan.verified ? 'Verified merchant' : 'QR not verified'}
                  </Text>
                  <Text className="text-[10px] text-white/50">{formatHistoryDate(scan.scannedAt)}</Text>
                </View>
                <Text className="mt-2 text-sm text-white">{scan.merchantName || scan.message}</Text>
                {scan.merchantId ? <Text className="mt-1 text-xs text-white/65">Merchant ID: {scan.merchantId}</Text> : null}
                {scan.phoneNumber ? <Text className="text-xs text-white/65">Phone: {scan.phoneNumber}</Text> : null}
                {scan.shopLocation ? <Text className="text-xs text-white/65">Location: {scan.shopLocation}</Text> : null}
                <Text className="mt-2 text-[10px] uppercase tracking-wider text-white/45">Result: {scan.status}</Text>
              </View>
            ))}

            <Text className="mb-3 mt-8 text-lg font-extrabold text-white">Report history</Text>
            {consumerReports.length === 0 ? (
              <Text className="text-sm text-white/60">Reports you submit will appear here.</Text>
            ) : consumerReports.map((report) => (
              <View key={report.id} className="mb-3 rounded-xl border border-white bg-black p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-extrabold uppercase text-white">{report.reportReason}</Text>
                  <Text className="text-xs font-bold text-amber-300">{report.status}</Text>
                </View>
                <Text className="mt-2 text-sm text-white">{report.merchantName || report.merchantId || 'Unidentified merchant'}</Text>
                {report.details ? <Text className="mt-1 text-xs leading-5 text-white/65">{report.details}</Text> : null}
                {report.adminNotes ? <Text className="mt-2 text-xs text-white/80">Government note: {report.adminNotes}</Text> : null}
                {report.riskPointsApplied ? <Text className="mt-2 text-xs font-extrabold text-red-300">Government confirmed this report</Text> : null}
                <Text className="mt-2 text-[10px] text-white/45">{report.createdAt ? formatHistoryDate(report.createdAt) : 'Submitted report'}</Text>
              </View>
            ))}
          </>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function DashboardAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[86px] flex-1 items-center justify-center gap-2 rounded-xl border border-white bg-black"
    >
      <Icon size={24} color="#FFFFFF" />
      <Text className="text-xs font-bold text-white">{label}</Text>
    </Pressable>
  );
}
