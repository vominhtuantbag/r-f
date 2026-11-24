import type { AuthSession, UserRole } from '@ridefood/types';
import { getSupabase, isSupabaseMockMode } from '../client';
import { demoUsers, findUserByPhone, getMockStore, IDS, newId } from '../mock';
import { ensureRiderProfile, fetchProfile } from './profile';
import { buildAuthSessionFromSupabase } from './session';

export type AppAuthRole = Extract<UserRole, 'rider' | 'driver' | 'partner'>;

export function normalizeAuthPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 9) return `+84${digits.slice(1)}`;
  if (digits.length >= 9) return `+84${digits}`;
  return raw.trim();
}

function mockTokens(userId: string) {
  return {
    accessToken: `mock-access-${userId}`,
    refreshToken: `mock-refresh-${userId}`,
    tokenType: 'Bearer' as const,
    expiresIn: 86_400,
  };
}

function mapAuthError(error: { message?: string; status?: number; code?: string }): Error {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('phone') && (msg.includes('provider') || msg.includes('disabled'))) {
    return new Error(
      'Supabase Phone Auth chưa bật. Vào Dashboard → Authentication → Providers → Phone, bật provider (và SMS nếu cần xác minh).',
    );
  }
  if (msg.includes('sms') || msg.includes('twilio') || msg.includes('messagebird')) {
    return new Error(
      'Supabase Phone Auth cần cấu hình SMS (Twilio/MessageBird/…). Hoặc tắt “Confirm phone” để test password signup.',
    );
  }
  if (msg.includes('already') || msg.includes('registered') || error.status === 422) {
    return new Error('Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.');
  }
  return new Error(error.message || 'Yêu cầu xác thực thất bại');
}

export interface SignInWithPhonePasswordOptions {
  phone: string;
  password: string;
  role?: AppAuthRole;
}

/** Phone + password sign-in (Supabase Phone Auth or mock). */
export async function signInWithPhonePassword(
  options: SignInWithPhonePasswordOptions,
): Promise<AuthSession> {
  const phone = normalizeAuthPhone(options.phone);
  const role = options.role ?? 'rider';

  if (isSupabaseMockMode()) {
    await new Promise((r) => setTimeout(r, 250));
    const store = getMockStore();
    const byPhone = findUserByPhone(phone);
    const user = byPhone ?? demoUsers[role];
    store.currentUserId = user.id;
    return { user, tokens: mockTokens(user.id) };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    phone,
    password: options.password,
  });
  if (error) throw mapAuthError(error);
  if (!data.session) throw new Error('Đăng nhập thất bại — không có phiên');
  return buildAuthSessionFromSupabase(data.session);
}

export interface SignUpRiderOptions {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  marketId?: string | null;
  locale?: string;
  email?: string | null;
  referralCode?: string | null;
  fullName?: string | null;
}

export type SignUpRiderResult =
  | { status: 'authenticated'; session: AuthSession; mocked: false }
  | {
      status: 'confirmation_required';
      userId: string | null;
      phone: string;
      message: string;
      mocked: false;
    }
  | { status: 'authenticated'; session: AuthSession; mocked: true };

/**
 * Register a rider against Supabase Auth.
 * `handle_new_user` trigger creates `public.profiles`; we also ensure/fetch the row
 * when a session is returned.
 */
export async function signUpRider(
  options: SignUpRiderOptions,
): Promise<SignUpRiderResult> {
  const phone = normalizeAuthPhone(options.phone);
  const firstName = options.firstName.trim();
  const lastName = options.lastName.trim();
  const fullName =
    (options.fullName?.trim() || `${lastName} ${firstName}`.trim()).trim() ||
    firstName ||
    'Rider';
  const marketId =
    options.marketId && options.marketId !== 'song-doc' ? options.marketId : null;

  if (isSupabaseMockMode()) {
    await new Promise((r) => setTimeout(r, 300));
    const store = getMockStore();
    const id = newId('usr');
    const now = new Date().toISOString();
    const user = {
      ...demoUsers.rider,
      id,
      phone,
      phoneVerified: true,
      firstName: firstName || demoUsers.rider.firstName,
      lastName: lastName || demoUsers.rider.lastName,
      email: options.email ?? `rider.${id}@goxe.vn`,
      locale: options.locale ?? 'vi',
      marketId: marketId ?? IDS.marketHcm,
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(user);
    store.currentUserId = user.id;
    return {
      status: 'authenticated',
      session: { user, tokens: mockTokens(user.id) },
      mocked: true,
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    phone,
    password: options.password,
    options: {
      data: {
        role: 'rider',
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone,
        locale: options.locale ?? 'vi',
        market_id: marketId,
        referral_code: options.referralCode?.trim() || null,
      },
    },
  });

  if (error) throw mapAuthError(error);

  const authUser = data.user;
  const session = data.session;

  if (!session) {
    // User row may already exist in auth.users; confirmation / SMS pending.
    return {
      status: 'confirmation_required',
      userId: authUser?.id ?? null,
      phone,
      message:
        'Đăng ký đã gửi lên Supabase. Vui lòng xác minh số điện thoại (OTP/SMS) rồi đăng nhập. Kiểm tra Authentication → Users.',
      mocked: false,
    };
  }

  // Trigger should have created profiles; ensure + fetch for session persistence.
  try {
    await ensureRiderProfile({
      userId: session.user.id,
      phone,
      email: session.user.email ?? options.email ?? null,
      firstName,
      lastName,
      locale: options.locale ?? 'vi',
      marketId,
    });
  } catch (ensureErr) {
    console.warn('[@ridefood/supabase] ensureRiderProfile after signUp', ensureErr);
  }

  // Brief retry if trigger lags (rare)
  let profile = await fetchProfile(session.user.id);
  if (!profile) {
    await new Promise((r) => setTimeout(r, 400));
    profile = await fetchProfile(session.user.id);
  }

  const authSession = await buildAuthSessionFromSupabase(session);
  if (!profile) {
    console.warn(
      '[@ridefood/supabase] auth.users created but public.profiles missing — check handle_new_user trigger / RLS.',
    );
  }

  return { status: 'authenticated', session: authSession, mocked: false };
}
