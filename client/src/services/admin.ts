import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android' && !Constants.expoConfig?.hostUri) return 'http://10.0.2.2:4000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  return `http://${host}:4000`;
}

const API_URL = getApiUrl();

export type AdminOverview = {
  pending: number;
  approved: number;
  rejected: number;
  openReports: number;
};

export type VerificationQueueItem = {
  id: string;
  merchantAccountId: string;
  merchantId: string;
  merchantName: string;
  phoneNumber: string;
  upiId: string;
  shopLocation: string;
  qrData: string;
  govId: string;
  verificationStatus: 'pending' | 'verified' | 'invalid' | 'approved' | 'rejected';
  qrHash: string;
  submittedAt?: string;
  notes?: string;
  riskPoints: number;
};

export type MerchantReportItem = {
  id: string;
  reportedBy: string;
  merchantAccountId?: string | null;
  merchantId: string;
  merchantName: string;
  merchantUpiId: string;
  qrData: string;
  reportReason: 'scam' | 'spam' | 'mismatch' | 'other';
  details: string;
  status: 'pending' | 'on_progress' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt?: string;
  riskPointsApplied?: boolean;
  merchantVerificationStatus?: 'pending' | 'verified' | 'invalid' | 'approved' | 'rejected' | 'not_found';
  merchantRiskPoints?: number;
  merchantPhoneNumber?: string;
  merchantShopLocation?: string;
};

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Request failed');
  }

  return body as T;
}

export async function getAdminOverview(token: string) {
  return request<{ overview: AdminOverview }>('/api/admin/overview', { method: 'GET' }, token);
}

export async function getVerificationQueue(token: string) {
  return request<{ records: VerificationQueueItem[] }>('/api/admin/verification-queue', { method: 'GET' }, token);
}

export async function decideVerification(token: string, id: string, decision: 'verified' | 'invalid', notes?: string) {
  return request<{ message: string; record: VerificationQueueItem }>(`/api/admin/verification/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  }, token);
}

export async function getMerchantReports(token: string) {
  return request<{ reports: MerchantReportItem[] }>('/api/admin/reports', { method: 'GET' }, token);
}

export async function resolveMerchantReport(token: string, id: string, status: 'pending' | 'on_progress' | 'resolved' | 'dismissed', notes?: string) {
  return request<{ message: string; report: MerchantReportItem }>(`/api/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ status, notes }),
  }, token);
}
