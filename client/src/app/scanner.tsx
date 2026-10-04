import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { type ComponentType, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitMerchantReport, verifyQr } from '@/services/merchant';

const CameraViewComponent = CameraView as unknown as ComponentType<any>;

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [hash, setHash] = useState<string | null>(null);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<'scam' | 'spam' | 'mismatch' | 'other'>('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanLinePosition] = useState(() => new Animated.Value(0));
  const [result, setResult] = useState<null | {
    verified: boolean;
    status: string;
    message: string;
    merchantName?: string;
    merchantId?: string;
    upiId?: string;
    shopLocation?: string;
  }>(null);

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (hash) return;

    const cleaned = data.trim();
    setScannedValue(cleaned);
    const qrHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, cleaned);
    setHash(qrHash);

    try {
      const response = await verifyQr({ qrData: cleaned, qrHash });
      setResult(response);
    } catch (error) {
      setResult({
        verified: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to verify QR.',
      });
    }
  };

  async function handleSubmitReport() {
    if (!scannedValue) return;

    try {
      const response = await submitMerchantReport({
        merchantId: result?.merchantId,
        merchantName: result?.merchantName,
        upiId: result?.upiId,
        qrData: scannedValue,
        reportReason,
        details: reportDetails,
      });

      setReportStatus(response.message || 'Report submitted successfully.');
      setReporting(false);
      setReportDetails('');
    } catch (error) {
      setReportStatus(error instanceof Error ? error.message : 'Unable to submit report.');
    }
  }

  useEffect(() => {
    if (!permission?.granted || hash) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePosition, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLinePosition, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [hash, permission?.granted, scanLinePosition]);

  if (!permission?.granted) {
    return (
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1 justify-center p-7">
          <Text className="text-[11px] font-bold tracking-[2px] text-white">SECQRYPT SCANNER</Text>
          <Text className="mt-3 text-[34px] font-extrabold leading-[38px] text-white">Camera access required</Text>
          <Text className="mt-4 max-w-lg text-base leading-6 text-white/70">
            Allow camera access to scan a QR code and verify it against the approved merchant records in the database.
          </Text>
          {permission && !permission.canAskAgain ? <Text className="mt-3 text-sm text-red-400">Camera access is blocked. Enable camera permission in your device or browser settings, then reopen this screen.</Text> : null}
          <Pressable onPress={requestPermission} className="mt-5 items-center bg-white py-4">
            <Text className="text-sm font-extrabold text-black">Allow camera</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="mt-1 items-center py-4">
            <Text className="text-sm font-bold text-white/70">Return home</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraViewComponent
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={hash ? undefined : handleScan}
        onMountError={(event: { message: string }) => setCameraError(event.message || 'The camera could not be opened.')}
      />
      {!hash && <ScanOverlay position={scanLinePosition} />}

      <SafeAreaView className="flex-1 justify-between p-6">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center bg-black/80">
            <Text className="text-[28px] font-light leading-[30px] text-white">×</Text>
          </Pressable>
          <Text className="text-[17px] font-extrabold tracking-wide text-white">SecQrypt</Text>
          <View className="w-10" />
        </View>

        {cameraError ? <View className="rounded-lg bg-red-950/90 p-3"><Text className="text-sm text-red-200">{cameraError}</Text></View> : null}

        {!hash ? (
          <View className="mb-14 items-center">
            <View className="relative h-[250px] w-[250px]">
              <View className="absolute left-0 top-0 h-[34px] w-[34px] border-l-[3px] border-t-[3px] border-white" />
              <View className="absolute right-0 top-0 h-[34px] w-[34px] border-r-[3px] border-t-[3px] border-white" />
              <View className="absolute bottom-0 left-0 h-[34px] w-[34px] border-b-[3px] border-l-[3px] border-white" />
              <View className="absolute bottom-0 right-0 h-[34px] w-[34px] border-b-[3px] border-r-[3px] border-white" />
            </View>
            <Text className="mt-7 text-base font-bold text-white">Align QR code within frame</Text>
            <Text className="mt-2 text-[13px] text-white/70">Scanning stays on this device and verifies against the backend.</Text>
          </View>
        ) : (
          <View className="mb-5 rounded-xl bg-white p-6">
            <View className="flex-row items-center">
              <View className={`mr-2 h-2 w-2 rounded-full ${result?.verified ? 'bg-green-500' : 'bg-red-500'}`} />
              <Text className="text-[10px] font-extrabold tracking-[1px] text-black">
                {result?.verified ? 'QR VERIFIED' : 'QR CHECK FAILED'}
              </Text>
            </View>

            {result?.verified ? (
              <>
                <Text className="mt-2 text-[10px] font-extrabold tracking-[1px] text-green-700">VERIFIED MERCHANT</Text>
                <Text className="mt-2 text-[27px] font-extrabold text-black">{result.merchantName}</Text>
                <Text className="mt-2 text-sm text-black/70">Merchant ID: {result.merchantId}</Text>
                <Text className="text-sm text-black/70">UPI ID: {result.upiId}</Text>
                <Text className="text-sm text-black/70">Location: {result.shopLocation}</Text>
                <Text className="mt-4 text-sm font-extrabold text-green-700">Status: {result.status}</Text>
              </>
            ) : (
              <>
                <Text className="mt-2 text-[22px] font-extrabold text-black">{result?.status === 'not_registered' ? 'Not Verified' : 'Warning'}</Text>
                <Text className="mt-2 text-sm text-black/80">{result?.message || 'The scanned QR could not be validated.'}</Text>
              </>
            )}

            {!result?.verified && (
              <Pressable onPress={() => setReporting((value) => !value)} className="mt-4 items-center bg-red-500 py-3">
                <Text className="text-sm font-extrabold text-white">{reporting ? 'Hide report form' : 'Report this merchant'}</Text>
              </Pressable>
            )}

            {reporting && !result?.verified && (
              <View className="mt-4 gap-3">
                <Text className="text-xs font-bold uppercase tracking-wider text-black">Report reason</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['spam', 'scam', 'mismatch', 'other'] as const).map((value) => (
                    <Pressable key={value} onPress={() => setReportReason(value)} className={`rounded-full border px-3 py-2 ${reportReason === value ? 'border-black bg-black' : 'border-black bg-white'}`}>
                      <Text className={`text-xs font-bold ${reportReason === value ? 'text-white' : 'text-black'}`}>{value.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput value={reportDetails} onChangeText={setReportDetails} placeholder="Add details about the suspicious merchant or QR." placeholderTextColor="#777777" multiline className="min-h-[80px] rounded-lg border border-black bg-white px-3 py-3 text-black" />

                <Pressable onPress={handleSubmitReport} className="items-center bg-black py-3">
                  <Text className="text-sm font-extrabold text-white">Submit report</Text>
                </Pressable>
              </View>
            )}

            {reportStatus ? <Text className="mt-3 text-xs font-medium text-black/80">{reportStatus}</Text> : null}

            <View className="mt-4 border border-black bg-white p-3">
              <Text className="mb-2 text-[10px] font-extrabold tracking-[1px] text-black/60">QR SHA-256 HASH</Text>
              <Text className="font-mono text-xs leading-[18px] text-black" selectable>{hash}</Text>
            </View>

            <Pressable onPress={() => Clipboard.setStringAsync(hash || '')} className="mt-4 items-center bg-black py-4">
              <Text className="text-sm font-extrabold text-white">Copy fingerprint</Text>
            </Pressable>

            <Pressable onPress={() => { setHash(null); setResult(null); setScannedValue(null); }} className="mt-3 items-center border border-black py-4">
              <Text className="text-sm font-extrabold text-black">Scan another QR</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function ScanOverlay({ position }: { position: Animated.Value }) {
  const translateY = position.interpolate({ inputRange: [0, 1], outputRange: [12, 252] });

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <View className="h-[250px] w-[250px] border-2 border-white/90">
        <Animated.View style={{ transform: [{ translateY }] }} className="absolute left-2 right-2 h-0.5 bg-cyan-300 shadow-lg" />
      </View>
      <Text className="absolute bottom-16 text-sm font-bold tracking-wider text-white">ALIGN QR WITHIN FRAME</Text>
    </View>
  );
}
