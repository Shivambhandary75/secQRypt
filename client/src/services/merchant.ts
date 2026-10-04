import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getToken } from './auth';

export type MerchantVerificationStatus = 'not_applied' | 'pending' | 'verified' | 'invalid' | 'approved' | 'rejected';

export type MerchantVerificationRecord = {
  id: string;
  merchantId: string;
  merchantName: string;
  phoneNumber: string;
  upiId: string;
  shopLocation: string;
  govId?: string;
  qrData: string;
  qrHash?: string;
  verificationStatus: MerchantVerificationStatus;
  submittedAt?: string;
  notes?: string;
};

export type MerchantReportReason = 'scam' | 'spam' | 'mismatch' | 'other';

export type ConsumerReport = {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantUpiId: string;
  reportReason: MerchantReportReason;
  details: string;
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt?: string;
};

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android' && !Constants.expoConfig?.hostUri) return 'http://10.0.2.2:4000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  return `http://${host}:4000`;
}

const API_URL = getApiUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Request failed');
  }

  return body as T;
}

export async function getMerchantStatus() {
  const token = await getToken();

  return request<{ status: MerchantVerificationStatus; record: MerchantVerificationRecord | null }>('/api/merchant/status', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function applyMerchantVerification(payload: {
  merchantName: string;
  phoneNumber: string;
  upiId: string;
  shopLocation: string;
  govId: string;
  qrData: string;
  qrHash: string;
  notes?: string;
}) {
  const token = await getToken();

  return request<{ message: string; record: MerchantVerificationRecord }>('/api/merchant/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function removeMerchantVerification() {
  const token = await getToken();

  return request<{ message: string }>('/api/merchant/application', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function submitMerchantReport(payload: {
  merchantId?: string;
  merchantName?: string;
  upiId?: string;
  qrData?: string;
  reportReason?: MerchantReportReason;
  details?: string;
}) {
  const token = await getToken();

  return request<{ message: string; report: { id: string; merchantId: string; merchantName: string; reportReason: MerchantReportReason; details: string; status: string } }>('/api/merchant/report', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getMyMerchantReports() {
  const token = await getToken();
  return request<{ reports: ConsumerReport[] }>('/api/merchant/reports/mine', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function verifyQr(payload: { qrData: string; qrHash: string }) {
  return request<{
    verified: boolean;
    status: string;
    message: string;
    qrHash?: string;
    merchantName?: string;
    merchantId?: string;
    phoneNumber?: string;
    upiId?: string;
    shopLocation?: string;
  }>('/api/verify/qr', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
