import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@ridefood/config';
import type { Database } from './database.types';
import { getMockStore } from './mock/store';
import {
  createExpoAuthStorage,
  createMemoryAuthStorage,
  type AuthStorageAdapter,
} from './storage';

export type RideFoodSupabase = SupabaseClient<Database>;

let browserClient: RideFoodSupabase | null = null;
let mockWarned = false;

/** Reject accidental service_role / sb_secret usage in any client bundle. */
function assertAnonKey(key: string): void {
  const lower = key.toLowerCase();
  if (
    lower.includes('service_role') ||
    lower.includes('service-role') ||
    lower.startsWith('sb_secret_')
  ) {
    throw new Error(
      '[@ridefood/supabase] Refusing to create a client with a privileged key (service_role / sb_secret_*). Use EXPO_PUBLIC_SUPABASE_ANON_KEY or sb_publishable_… only.',
    );
  }
}

export function isSupabaseMockMode(): boolean {
  return getEnv().isMockMode;
}

export interface CreateSupabaseClientOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  persistSession?: boolean;
  /** Override storage (tests). Defaults to Expo secure/persistent adapter. */
  storage?: AuthStorageAdapter;
  /**
   * Detect OAuth redirect tokens in the URL (Web). Disable on native —
   * deep links are handled via `completeGoogleOAuthFromRedirectUrl`.
   */
  detectSessionInUrl?: boolean;
}

/**
 * Typed Supabase client for Expo Web / Android / iOS.
 * - Uses **anon** key only (never `service_role`).
 * - Persists sessions via SecureStore / AsyncStorage / localStorage.
 * - When `EXPO_PUBLIC_MOCK_MODE=true`, uses memory storage and warms the mock store.
 */
export function createSupabaseClient(
  options: CreateSupabaseClientOptions = {},
): RideFoodSupabase {
  const env = getEnv();
  const anonKey = options.supabaseAnonKey ?? env.supabaseAnonKey;
  assertAnonKey(anonKey);

  const mock = env.isMockMode;
  if (mock && !mockWarned) {
    mockWarned = true;
    getMockStore();
    if (env.isDev) {
      console.info(
        '[@ridefood/supabase] LOCAL_MOCK_MODE active — using in-memory Vietnamese Ride & Food seed data.',
      );
    }
  }

  const persistSession = options.persistSession ?? !mock;
  const storage =
    options.storage ??
    (mock || !persistSession ? createMemoryAuthStorage() : createExpoAuthStorage());

  const isWeb =
    typeof window !== 'undefined' && typeof document !== 'undefined';

  return createClient<Database>(
    options.supabaseUrl ?? env.supabaseUrl,
    anonKey,
    {
      auth: {
        storage,
        persistSession,
        autoRefreshToken: !mock,
        detectSessionInUrl: options.detectSessionInUrl ?? (!mock && isWeb),
        flowType: 'pkce',
      },
      realtime: {
        params: { eventsPerSecond: 8 },
      },
      global: {
        headers: {
          'x-ridefood-client': 'expo',
        },
      },
    },
  );
}

/** Singleton for Expo apps (Web/Android/iOS). */
export function getSupabase(): RideFoodSupabase {
  if (!browserClient) {
    browserClient = createSupabaseClient();
  }
  return browserClient;
}

/** Reset singleton (tests / env hot-reload). */
export function resetSupabaseClient(): void {
  browserClient = null;
}

export { getMockStore, resetMockStore } from './mock/store';
export type { AuthStorageAdapter } from './storage';
export { createExpoAuthStorage, createMemoryAuthStorage } from './storage';
