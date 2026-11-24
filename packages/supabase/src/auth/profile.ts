import type { AuthTokens, User, UserRole } from '@ridefood/types';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { getSupabase, isSupabaseMockMode } from '../client';
import { demoUsers, getMockStore } from '../mock';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export function tokensFromSession(session: Session): AuthTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: 'Bearer',
    expiresIn: session.expires_in ?? 3600,
  };
}

export function mapProfileToUser(
  row: ProfileRow,
  extras?: { phoneVerified?: boolean; avatarUrl?: string | null },
): User {
  const now = new Date().toISOString();
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    phone: row.phone ?? '',
    phoneVerified: extras?.phoneVerified ?? Boolean(row.phone),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    avatarUrl: extras?.avatarUrl ?? null,
    locale: row.locale || 'vi',
    marketId: row.market_id,
    walletBalanceMinor: row.wallet_balance_minor ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Load `public.profiles` for the authenticated user (RLS: own row or staff). */
export async function fetchProfile(userId: string): Promise<User | null> {
  if (isSupabaseMockMode()) {
    const store = getMockStore();
    return store.users.find((u) => u.id === userId) ?? null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProfileToUser(data as ProfileRow);
}

/**
 * Ensure `public.profiles` exists for the signed-in user.
 * Prefer the `handle_new_user` trigger; this upsert is a safe fallback when
 * RLS allows insert/update on own row (see CONSOLIDATED_SCHEMA policies).
 */
export async function ensureRiderProfile(input: {
  userId: string;
  phone: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  locale?: string;
  marketId?: string | null;
}): Promise<User> {
  if (isSupabaseMockMode()) {
    const existing = await fetchProfile(input.userId);
    if (existing) return existing;
    throw new Error('Mock profile missing');
  }

  const existing = await fetchProfile(input.userId);
  if (existing) {
    // Keep phone / name in sync after Google or incomplete metadata
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        phone: input.phone || existing.phone,
        email: input.email ?? existing.email,
        first_name: input.firstName || existing.firstName,
        last_name: input.lastName || existing.lastName,
        locale: input.locale || existing.locale,
        market_id: input.marketId ?? existing.marketId,
      })
      .eq('id', input.userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (data) return mapProfileToUser(data as ProfileRow);
    return existing;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: input.userId,
      role: 'rider',
      phone: input.phone,
      email: input.email ?? null,
      first_name: input.firstName,
      last_name: input.lastName,
      locale: input.locale ?? 'vi',
      market_id: input.marketId ?? null,
      phone_verified: false,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    // Trigger may have won the race — re-fetch
    const again = await fetchProfile(input.userId);
    if (again) return again;
    throw error;
  }
  if (!data) {
    const again = await fetchProfile(input.userId);
    if (again) return again;
    throw new Error('Không tạo được hồ sơ profiles');
  }
  return mapProfileToUser(data as ProfileRow);
}

/**
 * Resolve app User from a Supabase auth session:
 * prefer `profiles` row (created by `handle_new_user` trigger), else metadata fallback.
 */
export async function resolveUserFromSession(
  session: Session,
  fallbackRole: UserRole = 'rider',
): Promise<User> {
  const authUser = session.user;
  const profile = await fetchProfile(authUser.id);
  if (profile) {
    return {
      ...profile,
      phoneVerified: Boolean(authUser.phone_confirmed_at || profile.phone),
      avatarUrl:
        profile.avatarUrl ??
        (typeof authUser.user_metadata?.avatar_url === 'string'
          ? authUser.user_metadata.avatar_url
          : typeof authUser.user_metadata?.picture === 'string'
            ? authUser.user_metadata.picture
            : null),
    };
  }

  const meta = authUser.user_metadata ?? {};
  const role =
    (typeof meta.role === 'string' ? (meta.role as UserRole) : null) ?? fallbackRole;
  const now = new Date().toISOString();
  return {
    id: authUser.id,
    role,
    email: authUser.email ?? null,
    phone: authUser.phone ?? '',
    phoneVerified: Boolean(authUser.phone_confirmed_at),
    firstName:
      (typeof meta.first_name === 'string' && meta.first_name) ||
      (typeof meta.given_name === 'string' && meta.given_name) ||
      '',
    lastName:
      (typeof meta.last_name === 'string' && meta.last_name) ||
      (typeof meta.family_name === 'string' && meta.family_name) ||
      '',
    avatarUrl:
      typeof meta.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta.picture === 'string'
          ? meta.picture
          : null,
    locale: (typeof meta.locale === 'string' && meta.locale) || 'vi',
    marketId: typeof meta.market_id === 'string' ? meta.market_id : null,
    walletBalanceMinor: 0,
    createdAt: authUser.created_at ?? now,
    updatedAt: now,
  };
}

export function mockUserForRole(role: Extract<UserRole, 'rider' | 'driver' | 'partner'>): User {
  return demoUsers[role];
}
