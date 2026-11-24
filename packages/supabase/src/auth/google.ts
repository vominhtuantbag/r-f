import { getEnv } from '@ridefood/config';
import type { AuthSession, AuthTokens, User, UserRole } from '@ridefood/types';
import { getSupabase, isSupabaseMockMode } from '../client';
import { demoUsers, getMockStore, IDS } from '../mock';
import { buildAuthSessionFromSupabase } from './session';

function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export type GoogleAuthRole = Extract<UserRole, 'rider' | 'driver' | 'partner'>;

export interface GoogleSignInOptions {
  role?: GoogleAuthRole;
  marketId?: string | null;
  redirectTo?: string;
  openAuthSession?: (
    url: string,
    redirectTo: string,
  ) => Promise<{ type: string; url?: string | null }>;
  forceMock?: boolean;
}

export interface GoogleSignInResult {
  session: AuthSession;
  provider: 'google';
  mocked: boolean;
}

const MOCK_GOOGLE_IDS: Record<GoogleAuthRole, string> = {
  rider: 'usr-google-rider-001',
  driver: 'usr-google-driver-001',
  partner: 'usr-google-partner-001',
};

function tokensFor(userId: string): AuthTokens {
  return {
    accessToken: `mock-google-access-${userId}`,
    refreshToken: `mock-google-refresh-${userId}`,
    tokenType: 'Bearer',
    expiresIn: 86_400,
  };
}

/** Realistic local Google account used when MOCK_MODE or OAuth is not configured. */
export function createMockGoogleAuthSession(options?: {
  role?: GoogleAuthRole;
  marketId?: string | null;
}): AuthSession {
  const role = options?.role ?? 'rider';
  const base = demoUsers[role];
  const id = MOCK_GOOGLE_IDS[role];
  const now = new Date().toISOString();
  const user: User = {
    ...base,
    id,
    email: `google.${role}@goxe.vn`,
    firstName: role === 'rider' ? 'Minh' : base.firstName,
    lastName: role === 'rider' ? 'Nguyễn' : base.lastName,
    phone: base.phone || '+84900000000',
    phoneVerified: true,
    avatarUrl: null,
    marketId:
      options?.marketId && options.marketId !== 'song-doc'
        ? options.marketId
        : (base.marketId ?? IDS.marketHcm),
    updatedAt: now,
  };

  const store = getMockStore();
  const existing = store.users.find((u) => u.id === id);
  if (!existing) store.users.push(user);
  else Object.assign(existing, user);
  store.currentUserId = user.id;

  return { user, tokens: tokensFor(user.id) };
}

function isOAuthConfigured(): boolean {
  const env = getEnv();
  if (env.isMockMode || isSupabaseMockMode()) return false;
  if (!env.supabaseUrl || !env.supabaseAnonKey) return false;
  // Mirror config: reject secrets / placeholders
  const key = env.supabaseAnonKey.toLowerCase();
  if (key.startsWith('sb_secret_') || key.includes('service_role')) return false;
  return true;
}

function pickParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((v, k) => {
      out[k] = v;
    });
    if (parsed.hash) {
      const hash = parsed.hash.replace(/^#/, '');
      new URLSearchParams(hash).forEach((v, k) => {
        out[k] = v;
      });
    }
  } catch {
    const q = url.includes('?')
      ? url.split('?')[1]
      : url.includes('#')
        ? url.split('#')[1]
        : '';
    if (q) {
      new URLSearchParams(q.replace(/#/g, '&')).forEach((v, k) => {
        out[k] = v;
      });
    }
  }
  return out;
}

/** Exchange OAuth redirect URL (query or hash tokens) into an app AuthSession. */
export async function completeGoogleOAuthFromRedirectUrl(
  url: string,
  _options?: { role?: GoogleAuthRole; marketId?: string | null },
): Promise<AuthSession> {
  const params = pickParams(url);
  if (params.error || params.error_description) {
    throw new Error(
      params.error_description || params.error || 'Google đăng nhập thất bại',
    );
  }

  const supabase = getSupabase();
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const code = params.code;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Không nhận được phiên Google');
    return buildAuthSessionFromSupabase(data.session);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session) throw new Error('Không nhận được phiên Google');
    return buildAuthSessionFromSupabase(data.session);
  }

  throw new Error('Thiếu mã xác thực Google trong URL chuyển hướng');
}

/**
 * Cross-platform Google Sign-In / Sign-Up.
 * - Mock / missing OAuth config → realistic local Google session.
 * - Live Supabase → PKCE OAuth via redirect / `openAuthSession`.
 */
export async function signInWithGoogle(
  options: GoogleSignInOptions = {},
): Promise<GoogleSignInResult> {
  const role = options.role ?? 'rider';
  const marketId = options.marketId ?? null;

  if (options.forceMock || !isOAuthConfigured()) {
    await new Promise((r) => setTimeout(r, 450));
    return {
      session: createMockGoogleAuthSession({ role, marketId }),
      provider: 'google',
      mocked: true,
    };
  }

  const env = getEnv();
  const redirectTo =
    options.redirectTo ??
    (isWebRuntime()
      ? `${window.location.origin}/auth/callback`
      : `${env.trackingWebBaseUrl.replace(/\/track$/, '')}/auth/callback`);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Không tạo được URL Google OAuth');

  if (options.openAuthSession) {
    const result = await options.openAuthSession(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      throw new Error('Đăng nhập Google đã bị hủy');
    }
    const session = await completeGoogleOAuthFromRedirectUrl(result.url, {
      role,
      marketId,
    });
    return { session, provider: 'google', mocked: false };
  }

  if (isWebRuntime()) {
    window.location.assign(data.url);
    await new Promise<never>(() => undefined);
  }

  throw new Error(
    'Google OAuth trên thiết bị này cần openAuthSession (expo-web-browser).',
  );
}
