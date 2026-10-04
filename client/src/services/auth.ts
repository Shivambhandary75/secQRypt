import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AuthRole = 'consumer' | 'merchant' | 'admin';
export type AuthUser = { id: string; role: AuthRole; email: string; username?: string; merchantId?: string; govId?: string };

type AuthResponse = { token: string; user: AuthUser };

const secureStorage = {
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(key, value);
      return;
    }

    const store = (SecureStore as any).default ?? SecureStore;
    if (typeof store.setItemAsync === 'function') {
      await store.setItemAsync(key, value);
      return;
    }

    throw new Error('Secure storage is unavailable on this platform.');
  },

  async getItem(key: string) {
    if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage.getItem(key);
    }

    const store = (SecureStore as any).default ?? SecureStore;
    if (typeof store.getItemAsync === 'function') {
      return store.getItemAsync(key);
    }

    return null;
  },

  async deleteItem(key: string) {
    if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(key);
      return;
    }

    const store = (SecureStore as any).default ?? SecureStore;
    if (typeof store.deleteItemAsync === 'function') {
      await store.deleteItemAsync(key);
      return;
    }
  },
};

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android' && !Constants.expoConfig?.hostUri) return 'http://10.0.2.2:4000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  return `http://${host}:4000`;
}

const API_URL = getApiUrl();
const TOKEN_KEY = 'secqr.auth.token';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request failed');
  return body as T;
}

export async function getToken() {
  return secureStorage.getItem(TOKEN_KEY);
}

export async function login(payload: { role: AuthRole; email: string; password: string; username?: string; merchantId?: string }) {
  const result = await request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  await secureStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function register(payload: { role: AuthRole; email: string; password: string; username?: string; merchantId?: string; govId?: string }) {
  const result = await request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  await secureStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function getSession() {
  const token = await secureStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const result = await request<{ user: AuthUser }>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return result.user;
  } catch {
    await secureStorage.deleteItem(TOKEN_KEY);
    return null;
  }
}

export async function logout() {
  await secureStorage.deleteItem(TOKEN_KEY);
}