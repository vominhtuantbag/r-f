import {
  getEnv,
  isClientPublishableKey,
  supabaseHostFromUrl,
} from '@ridefood/config';
import { getSupabase, isSupabaseMockMode, resetSupabaseClient } from './client';
import { fetchProfile } from './auth/profile';

export interface SupabaseDiagnosticReport {
  mode: 'real supabase' | 'mock';
  mockModeFlag: string;
  supabaseHost: string;
  hasUrl: boolean;
  hasPublishableOrAnonKey: boolean;
  keyKind: 'sb_publishable' | 'legacy_jwt_anon' | 'missing' | 'invalid_or_secret';
  authUserId: string | null;
  authPhone: string | null;
  authEmail: string | null;
  profileFound: boolean;
  profileRole: string | null;
  profilePhone: string | null;
  notes: string[];
  ok: boolean;
}

function classifyKey(key: string): SupabaseDiagnosticReport['keyKind'] {
  if (!key) return 'missing';
  const lower = key.toLowerCase();
  if (lower.startsWith('sb_secret_') || lower.includes('service_role')) {
    return 'invalid_or_secret';
  }
  if (key.startsWith('sb_publishable_')) return 'sb_publishable';
  if (key.startsWith('eyJ') && isClientPublishableKey(key)) return 'legacy_jwt_anon';
  if (isClientPublishableKey(key)) return 'sb_publishable';
  return 'invalid_or_secret';
}

/**
 * Dev-safe connection diagnostic — never returns raw secrets.
 * Call from AppProviders / a hidden debug screen.
 */
export async function diagnoseSupabaseConnection(): Promise<SupabaseDiagnosticReport> {
  const env = getEnv({ forceReload: true });
  const mockFlag =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MOCK_MODE) || '';
  const notes: string[] = [];
  const keyKind = classifyKey(env.supabaseAnonKey);

  const report: SupabaseDiagnosticReport = {
    mode: env.isMockMode ? 'mock' : 'real supabase',
    mockModeFlag: String(mockFlag || '(unset)'),
    supabaseHost: supabaseHostFromUrl(env.supabaseUrl),
    hasUrl: Boolean(env.supabaseUrl && !env.supabaseUrl.includes('127.0.0.1')),
    hasPublishableOrAnonKey: isClientPublishableKey(env.supabaseAnonKey),
    keyKind,
    authUserId: null,
    authPhone: null,
    authEmail: null,
    profileFound: false,
    profileRole: null,
    profilePhone: null,
    notes,
    ok: false,
  };

  if (env.isMockMode) {
    notes.push('Running in MOCK mode — Auth writes stay in-memory and will not appear in Supabase Dashboard.');
    report.ok = true;
    return report;
  }

  if (keyKind === 'invalid_or_secret') {
    notes.push('Client key looks invalid or privileged. Use anon JWT or sb_publishable_… only.');
    return report;
  }

  try {
    resetSupabaseClient();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      notes.push(`getSession error: ${error.message}`);
      return report;
    }

    const session = data.session;
    if (!session?.user) {
      notes.push('No active auth session (signed out). Sign up / sign in to verify profiles.');
      // Still verify REST reachability with a cheap public read
      const ping = await supabase.from('markets').select('id').limit(1);
      if (ping.error) {
        notes.push(`REST ping failed: ${ping.error.message}`);
        return report;
      }
      notes.push('REST reachable (markets select ok).');
      report.ok = true;
      return report;
    }

    report.authUserId = session.user.id;
    report.authPhone = session.user.phone ?? null;
    report.authEmail = session.user.email ?? null;

    const profile = await fetchProfile(session.user.id);
    if (profile) {
      report.profileFound = true;
      report.profileRole = profile.role;
      report.profilePhone = profile.phone;
      notes.push('public.profiles row fetched for current user.');
      report.ok = true;
    } else {
      notes.push(
        'auth session exists but public.profiles row not found — check handle_new_user trigger.',
      );
    }
  } catch (e) {
    notes.push(e instanceof Error ? e.message : 'diagnostic failed');
  }

  return report;
}

/** Pretty one-liner for Metro / browser console. */
export function formatSupabaseDiagnostic(report: SupabaseDiagnosticReport): string {
  return [
    `[@ridefood/supabase] mode=${report.mode}`,
    `host=${report.supabaseHost}`,
    `key=${report.keyKind}`,
    `mockFlag=${report.mockModeFlag}`,
    `user=${report.authUserId ?? 'none'}`,
    `profile=${report.profileFound ? 'yes' : 'no'}`,
    `ok=${report.ok}`,
    report.notes.length ? `notes=${report.notes.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export { isSupabaseMockMode };
