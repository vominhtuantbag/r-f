import type { UserRole } from '@ridefood/types';

export type AppVariant = 'rider' | 'driver' | 'partner' | 'admin' | 'landing';
export type RealtimeDriver = 'supabase' | 'polling';

export interface PaymentPublicKeys {
  stripePublishableKey: string;
  paypalClientId: string;
  razorpayKeyId: string;
  myFatoorahPublicKey: string;
}

export interface ClientEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** True when intentionally mocking or Supabase is not configured. */
  isMockMode: boolean;
  /** @deprecated Prefer `@ridefood/supabase` — kept for transitional `@ridefood/api` callers. */
  apiBaseUrl: string;
  realtimeDriver: RealtimeDriver;
  trackingWebBaseUrl: string;
  googleMapsApiKey: string;
  payments: PaymentPublicKeys;
  brandPrimary: string;
  brandSecondary: string;
  brandName: string;
  defaultLocale: string;
  defaultCurrency: string;
  appVariant: AppVariant;
  vercelEnv: string;
  isDev: boolean;
  /** Legacy Pusher/Reverb keys (optional; unused when realtimeDriver=supabase). */
  pusherKey: string;
  pusherCluster: string;
  wsBaseUrl: string;
}

function read(key: string, fallback = ''): string {
  const fromExpo =
    typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return (fromExpo && String(fromExpo).trim()) || fallback;
}

function requireUrl(value: string, fallback: string): string {
  const v = value || fallback;
  return v.replace(/\/$/, '');
}

function isPlaceholderKey(key: string): boolean {
  if (!key) return true;
  const lower = key.toLowerCase();
  return (
    lower.includes('your-anon-key') ||
    lower.includes('local-anon-key') ||
    lower === 'anon' ||
    lower === 'public-anon-key' ||
    lower.includes('replace-me') ||
    lower.includes('changeme')
  );
}

/** True for legacy JWT anon keys or new `sb_publishable_…` keys. */
export function isClientPublishableKey(key: string): boolean {
  if (!key || isPlaceholderKey(key)) return false;
  const lower = key.toLowerCase();
  if (
    lower.includes('service_role') ||
    lower.includes('service-role') ||
    lower.startsWith('sb_secret_')
  ) {
    return false;
  }
  if (key.startsWith('sb_publishable_')) return true;
  if (key.startsWith('eyJ')) return true; // legacy anon JWT
  // Unknown format — allow only if clearly not a secret and reasonably long
  return key.length >= 24;
}

/**
 * Client apps must never ship `service_role` / `sb_secret_*`.
 * Fail fast if a privileged key was mistakenly put in EXPO_PUBLIC_* vars.
 */
export function assertClientSafeSupabaseKeys(options?: {
  supabaseAnonKey?: string;
  envBag?: Record<string, string | undefined>;
}): void {
  const anon = options?.supabaseAnonKey ?? read('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const bag = options?.envBag ?? (typeof process !== 'undefined' ? process.env : {});
  const suspects = [
    anon,
    bag?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    bag?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    bag?.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    bag?.SUPABASE_SERVICE_ROLE_KEY,
    bag?.EXPO_PUBLIC_SUPABASE_KEY,
    bag?.EXPO_PUBLIC_SUPABASE_SECRET_KEY,
  ];
  for (const value of suspects) {
    if (!value) continue;
    const lower = value.toLowerCase();
    if (
      lower.includes('service_role') ||
      lower.includes('service-role') ||
      lower.startsWith('sb_secret_')
    ) {
      throw new Error(
        '[@ridefood/config] Privileged Supabase key detected in client env (service_role / sb_secret_*). Use EXPO_PUBLIC_SUPABASE_ANON_KEY or a sb_publishable_… key only.',
      );
    }
  }
}

function parseMockFlag(raw: string): 'true' | 'false' | 'unset' {
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return 'true';
  if (v === '0' || v === 'false' || v === 'no') return 'false';
  return 'unset';
}

/**
 * Mock when:
 * - EXPO_PUBLIC_MOCK_MODE=true, OR
 * - flag unset AND url/key missing/placeholder
 *
 * When EXPO_PUBLIC_MOCK_MODE=false explicitly, missing/invalid keys throw
 * (never silent-mock).
 */
export function detectMockMode(options?: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  explicitFlag?: string;
}): boolean {
  const flag = parseMockFlag(
    options?.explicitFlag ??
      read('EXPO_PUBLIC_MOCK_MODE', read('MOCK_MODE', '')),
  );

  if (flag === 'true') return true;

  const url = (options?.supabaseUrl ?? read('EXPO_PUBLIC_SUPABASE_URL')).trim();
  const key = (
    options?.supabaseAnonKey ??
    read('EXPO_PUBLIC_SUPABASE_ANON_KEY', read('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
  ).trim();
  const configured = Boolean(url && isClientPublishableKey(key));

  if (flag === 'false') {
    if (!configured) {
      throw new Error(
        '[@ridefood/config] EXPO_PUBLIC_MOCK_MODE=false but EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (or sb_publishable_…) are missing or invalid. Set real credentials or set MOCK_MODE=true.',
      );
    }
    return false;
  }

  // flag unset — convenience mock when unconfigured
  return !configured;
}

export function resolveAppVariant(explicit?: AppVariant): AppVariant {
  if (explicit) return explicit;
  const fromEnv = read('EXPO_PUBLIC_APP_VARIANT') as AppVariant | '';
  if (
    fromEnv === 'rider' ||
    fromEnv === 'driver' ||
    fromEnv === 'partner' ||
    fromEnv === 'admin' ||
    fromEnv === 'landing'
  ) {
    return fromEnv;
  }
  return 'rider';
}

/** Host only — never log full keys. */
export function supabaseHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || '(invalid-url)';
  }
}

export function createClientEnv(options?: { appVariant?: AppVariant }): ClientEnv {
  const appVariant = resolveAppVariant(options?.appVariant);

  const rawUrl = read('EXPO_PUBLIC_SUPABASE_URL');
  const rawKey = read(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    read('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  );
  assertClientSafeSupabaseKeys({ supabaseAnonKey: rawKey });
  const isMockMode = detectMockMode({
    supabaseUrl: rawUrl,
    supabaseAnonKey: rawKey,
  });

  const supabaseUrl = requireUrl(rawUrl, 'http://127.0.0.1:54321');
  const supabaseAnonKey = rawKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.local-anon-key';

  return {
    supabaseUrl,
    supabaseAnonKey,
    isMockMode,
    apiBaseUrl: requireUrl(
      read('EXPO_PUBLIC_API_BASE_URL'),
      isMockMode ? 'mock://ridefood' : `${supabaseUrl}/rest/v1`,
    ),
    realtimeDriver:
      (read('EXPO_PUBLIC_REALTIME_DRIVER', 'supabase') as RealtimeDriver) || 'supabase',
    trackingWebBaseUrl: requireUrl(
      read('EXPO_PUBLIC_TRACKING_WEB_BASE_URL'),
      'http://localhost:3000/track',
    ),
    googleMapsApiKey: read('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'),
    payments: {
      stripePublishableKey: read('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
      paypalClientId: read('EXPO_PUBLIC_PAYPAL_CLIENT_ID'),
      razorpayKeyId: read('EXPO_PUBLIC_RAZORPAY_KEY_ID'),
      myFatoorahPublicKey: read('EXPO_PUBLIC_MYFATOORAH_API_KEY_PUBLIC'),
    },
    brandPrimary: read('EXPO_PUBLIC_BRAND_PRIMARY', '#24B8C4'),
    brandSecondary: read('EXPO_PUBLIC_BRAND_SECONDARY', '#1BA8B5'),
    brandName: read('EXPO_PUBLIC_BRAND_NAME', 'GOXE'),
    defaultLocale: read('EXPO_PUBLIC_DEFAULT_LOCALE', 'vi'),
    defaultCurrency: read('EXPO_PUBLIC_DEFAULT_CURRENCY', 'VND'),
    appVariant,
    vercelEnv: read('VERCEL_ENV', 'development'),
    isDev: read('NODE_ENV', 'development') !== 'production',
    pusherKey: read('EXPO_PUBLIC_PUSHER_KEY'),
    pusherCluster: read('EXPO_PUBLIC_PUSHER_CLUSTER', 'ap1'),
    wsBaseUrl: read('EXPO_PUBLIC_WS_BASE_URL', 'ws://127.0.0.1:8080'),
  };
}

export const ROLE_FOR_VARIANT: Record<
  Exclude<AppVariant, 'landing' | 'admin'>,
  UserRole
> = {
  rider: 'rider',
  driver: 'driver',
  partner: 'partner',
};

let cachedEnv: ClientEnv | null = null;

export function getEnv(options?: { appVariant?: AppVariant; forceReload?: boolean }): ClientEnv {
  if (!cachedEnv || options?.forceReload) {
    cachedEnv = createClientEnv(options);
  }
  return cachedEnv;
}

/** Clear cached env (tests / after dotenv reload). */
export function resetEnvCache(): void {
  cachedEnv = null;
}
