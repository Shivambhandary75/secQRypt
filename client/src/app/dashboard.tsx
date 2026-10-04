import { useLocalSearchParams, useRouter } from 'expo-router';
import { LogOut, QrCode, ShieldCheck, Store, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { decideVerification, getAdminOverview, getMerchantReports, getVerificationQueue, resolveMerchantReport } from '@/services/admin';
import { getSession, getToken, logout, type AuthUser } from '@/services/auth';
import { getMerchantStatus, getMyMerchantReports, removeMerchantVerification, type ConsumerReport, type MerchantVerificationRecord, type MerchantVerificationStatus } from '@/services/merchant';
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
  const [adminActionError, setAdminActionError] = useState('');
  const [merchantActionError, setMerchantActionError] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [consumerReports, setConsumerReports] = useState<ConsumerReport[]>([]);

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

  async function handleReportResolution(id: string, status: 'reviewing' | 'resolved' | 'dismissed') {
    const token = await getToken();
    if (!token) return;

    const response = await resolveMerchantReport(token, id, status, status === 'resolved' ? 'Escalated and resolved by admin.' : 'Report reviewed and closed.');
    setAdminReports((reports) => reports.map((report) => (report.id === response.report.id ? response.report : report)));

    const overview = await getAdminOverview(token);
    setAdminOverview(overview.overview);
  }

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    router.replace('/role-selection');
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
                    <View className="mt-3 flex-row gap-2">
                      <Pressable onPress={() => handleReportResolution(report.id, 'resolved')} className="flex-1 rounded-lg bg-white px-2 py-2">
                        <Text className="text-center text-xs font-extrabold text-black">Resolve</Text>
                      </Pressable>
                      <Pressable onPress={() => handleReportResolution(report.id, 'dismissed')} className="flex-1 rounded-lg border border-white px-2 py-2">
                        <Text className="text-center text-xs font-extrabold text-white">Dismiss</Text>
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
