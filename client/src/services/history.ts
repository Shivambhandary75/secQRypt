import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ScanHistoryItem = {
  id: string;
  scannedAt: string;
  qrHash: string;
  verified: boolean;
  status: string;
  message: string;
  merchantName?: string;
  merchantId?: string;
  phoneNumber?: string;
  shopLocation?: string;
};

function getKey(userId: string) {
  return `secqr.scan.history.${userId}`;
}

async function readValue(key: string) {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage.getItem(key);
  }

  const store = (SecureStore as any).default ?? SecureStore;
  return typeof store.getItemAsync === 'function' ? store.getItemAsync(key) : null;
}

async function writeValue(key: string, value: string) {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(key, value);
    return;
  }

  const store = (SecureStore as any).default ?? SecureStore;
  if (typeof store.setItemAsync === 'function') await store.setItemAsync(key, value);
}

export async function getScanHistory(userId: string) {
  try {
    const value = await readValue(getKey(userId));
    return value ? (JSON.parse(value) as ScanHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveScanHistory(userId: string, item: Omit<ScanHistoryItem, 'id' | 'scannedAt'>) {
  const current = await getScanHistory(userId);
  const next: ScanHistoryItem[] = [
    { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, scannedAt: new Date().toISOString() },
    ...current,
  ].slice(0, 20);
  await writeValue(getKey(userId), JSON.stringify(next));
}