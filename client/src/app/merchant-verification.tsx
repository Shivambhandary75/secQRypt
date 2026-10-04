import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { applyMerchantVerification } from '@/services/merchant';

type LocationSuggestion = {
  id: string;
  name: string;
  details: string;
};

const CameraViewComponent = CameraView as unknown as React.ComponentType<any>;

export default function MerchantVerificationScreen() {
  const router = useRouter();
  const [merchantName, setMerchantName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [shopLocation, setShopLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [govId, setGovId] = useState('');
  const [qrData, setQrData] = useState('');
  const [qrHash, setQrHash] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scanLinePosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const query = shopLocation.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLocationLoading(true);

      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal },
        );
        const body = await response.json();
        const suggestions = (body.features || []).map((feature: any, index: number) => {
          const properties = feature.properties || {};
          const name = [properties.name, properties.street].filter(Boolean).join(', ') || query;
          const details = [properties.city, properties.state, properties.country].filter(Boolean).join(', ');

          return {
            id: `${feature.properties?.osm_id || index}-${name}`,
            name,
            details,
          };
        });

        setLocationSuggestions(suggestions);
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setLocationSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLocationLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [shopLocation]);

  async function submit() {
    setError('');

    if (!merchantName.trim() || !upiId.trim() || !shopLocation.trim() || !govId.trim() || !qrData.trim() || !qrHash.trim()) {
      setError('Merchant details, government ID, and a camera-scanned QR code are required.');
      return;
    }

    setLoading(true);

    try {
      await applyMerchantVerification({
        merchantName: merchantName.trim(),
        upiId: upiId.trim(),
        shopLocation: shopLocation.trim(),
        govId: govId.trim(),
        qrData: qrData.trim(),
        qrHash: qrHash.trim(),
        notes: notes.trim(),
      });

      router.replace('/dashboard?role=merchant');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit verification request.');
    } finally {
      setLoading(false);
    }
  }

  async function openQrCamera() {
    if (!cameraPermission?.granted) {
      const permissionResult = await requestCameraPermission();
      if (!permissionResult.granted) {
        setError('Camera access is required to scan your merchant QR code.');
        return;
      }
    }

    setError('');
    setCameraError('');
    setCameraScanning(true);
    setCameraOpen(true);
  }

  async function handleQrScan({ data }: BarcodeScanningResult) {
    if (!cameraScanning) return;

    const cleaned = data.trim();
    if (!cleaned) return;

    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, cleaned);
    setQrData(cleaned);
    setQrHash(hash);
    setCameraScanning(false);
    setCameraOpen(false);
  }

  useEffect(() => {
    if (!cameraOpen || !cameraScanning) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePosition, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLinePosition, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [cameraOpen, cameraScanning, scanLinePosition]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="p-7">
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-2 pt-2">
          <Text className="text-lg font-bold text-white">←</Text>
          <Text className="text-sm text-white/70">Back</Text>
        </Pressable>

        <Text className="mt-6 text-[11px] font-extrabold tracking-[2px] text-white">MERCHANT VERIFICATION</Text>
        <Text className="mt-3 text-[34px] font-extrabold leading-[38px] text-white">Apply for secQRypt Verification</Text>
        <Text className="mt-3 text-base leading-6 text-white/70">
          Submit your merchant details and approved QR data so consumers can verify your business before paying.
        </Text>

        <View className="mt-7 gap-4">
          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">Merchant Name</Text>
            <TextInput value={merchantName} onChangeText={setMerchantName} placeholder="ABC Stores" placeholderTextColor="#777777" className="mt-2 rounded-lg border border-white bg-black px-4 py-3 text-white" />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">UPI ID</Text>
            <TextInput value={upiId} onChangeText={setUpiId} placeholder="abcstores@upi" placeholderTextColor="#777777" autoCapitalize="none" className="mt-2 rounded-lg border border-white bg-black px-4 py-3 text-white" />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">Shop Location</Text>
            <TextInput
              value={shopLocation}
              onChangeText={setShopLocation}
              placeholder="Start typing a city or address"
              placeholderTextColor="#777777"
              autoCorrect={false}
              className="mt-2 rounded-lg border border-white bg-black px-4 py-3 text-white"
            />

            {locationLoading && <ActivityIndicator color="#FFFFFF" className="mt-2 self-start" />}

            {locationSuggestions.length > 0 && (
              <View className="mt-2 rounded-lg border border-white bg-white">
                {locationSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => {
                      setShopLocation([suggestion.name, suggestion.details].filter(Boolean).join(', '));
                      setLocationSuggestions([]);
                    }}
                    className="border-b border-black/10 px-3 py-3 last:border-b-0"
                  >
                    <Text className="text-sm font-bold text-black">{suggestion.name}</Text>
                    {suggestion.details ? <Text className="mt-1 text-xs text-black/60">{suggestion.details}</Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">Government / ID Number</Text>
            <TextInput value={govId} onChangeText={setGovId} placeholder="Aadhaar / PAN / GST / licence reference" placeholderTextColor="#777777" autoCapitalize="characters" className="mt-2 rounded-lg border border-white bg-black px-4 py-3 text-white" />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">Merchant QR Code</Text>
            <Text className="mt-2 text-sm leading-5 text-white/70">Scan the QR code with your camera. Its SHA-256 fingerprint will be sent with this application.</Text>

            {cameraOpen && cameraPermission?.granted ? (
              <View className="mt-3 overflow-hidden rounded-lg border border-white">
                <View style={{ height: 280, width: '100%' }}>
                  <CameraViewComponent
                    style={{ height: '100%', width: '100%' }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={cameraScanning ? handleQrScan : undefined}
                    onMountError={(event: { message: string }) => {
                      setCameraError(event.message || 'The camera could not be opened.');
                      setCameraScanning(false);
                    }}
                  />
                  <ScanOverlay position={scanLinePosition} />
                </View>
                {cameraError ? <Text className="bg-red-100 px-3 py-2 text-xs text-red-700">{cameraError}</Text> : null}
                <Pressable onPress={() => { setCameraOpen(false); setCameraScanning(false); }} className="items-center bg-white py-3">
                  <Text className="text-sm font-extrabold text-black">Cancel scan</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={openQrCamera} className="mt-3 items-center rounded-lg border border-white bg-white px-4 py-4">
                <Text className="text-sm font-extrabold text-black">Open camera and scan QR</Text>
              </Pressable>
            )}

            {qrHash ? (
              <View className="mt-3 rounded-lg border border-white bg-white p-3">
                <Text className="text-[10px] font-extrabold tracking-wider text-black/60">QR SHA-256 HASH</Text>
                <Text className="mt-2 font-mono text-xs leading-5 text-black" selectable>{qrHash}</Text>
                <Pressable onPress={() => { setQrData(''); setQrHash(''); }} className="mt-3 items-center border border-black py-2">
                  <Text className="text-xs font-extrabold text-black">Scan a different QR</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-white">Other Details</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Any extra verification details" placeholderTextColor="#777777" multiline className="mt-2 min-h-[72px] rounded-lg border border-white bg-black px-4 py-3 text-white" />
          </View>
        </View>

        {error ? <Text className="mt-4 text-sm font-medium text-red-500">{error}</Text> : null}

          <Pressable onPress={submit} disabled={loading} className="mt-7 rounded-xl bg-white px-4 py-4">
            {loading ? <ActivityIndicator color="#000" /> : <Text className="text-center text-[18px] font-bold text-black">Submit Request to Government</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanOverlay({ position }: { position: Animated.Value }) {
  const translateY = position.interpolate({ inputRange: [0, 1], outputRange: [12, 252] });

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <View className="h-[220px] w-[220px] border-2 border-white/90">
        <Animated.View style={{ transform: [{ translateY }] }} className="absolute left-2 right-2 h-0.5 bg-cyan-300 shadow-lg" />
      </View>
      <Text className="absolute bottom-3 text-xs font-bold tracking-wider text-white">ALIGN QR WITHIN FRAME</Text>
    </View>
  );
}
