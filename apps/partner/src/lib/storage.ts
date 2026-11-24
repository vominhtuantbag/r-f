import { Platform } from 'react-native';
import type { AuthTokens } from '@ridefood/types';

const TOKEN_KEY = 'rf.partner.tokens';
const USER_KEY = 'rf.partner.user';

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function getAsyncStorage() {
  try {
    return await import('@react-native-async-storage/async-storage');
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: AuthTokens | null): Promise<void> {
  const value = tokens ? JSON.stringify(tokens) : null;
  const secure = await getSecureStore();
  if (secure) {
    if (value) await secure.setItemAsync(TOKEN_KEY, value);
    else await secure.deleteItemAsync(TOKEN_KEY);
    return;
  }
  const asyncStorage = await getAsyncStorage();
  if (!asyncStorage) return;
  if (value) await asyncStorage.default.setItem(TOKEN_KEY, value);
  else await asyncStorage.default.removeItem(TOKEN_KEY);
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const secure = await getSecureStore();
  let raw: string | null = null;
  if (secure) {
    raw = await secure.getItemAsync(TOKEN_KEY);
  } else {
    const asyncStorage = await getAsyncStorage();
    raw = (await asyncStorage?.default.getItem(TOKEN_KEY)) ?? null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export async function saveJson<T>(key: string, value: T | null): Promise<void> {
  const asyncStorage = await getAsyncStorage();
  if (!asyncStorage) return;
  if (value == null) await asyncStorage.default.removeItem(key);
  else await asyncStorage.default.setItem(key, JSON.stringify(value));
}

export async function loadJson<T>(key: string): Promise<T | null> {
  const asyncStorage = await getAsyncStorage();
  const raw = await asyncStorage?.default.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export { USER_KEY };