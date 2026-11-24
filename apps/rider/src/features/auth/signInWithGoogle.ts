import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  signInWithGoogle as supabaseSignInWithGoogle,
  type GoogleSignInOptions,
  type GoogleSignInResult,
} from '@ridefood/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Rider-facing Google auth: mock-first locally, Expo OAuth bridge when Supabase is live.
 */
export async function signInWithGoogle(
  options: Omit<GoogleSignInOptions, 'openAuthSession' | 'redirectTo'> = {},
): Promise<GoogleSignInResult> {
  const redirectTo = AuthSession.makeRedirectUri({
    scheme: 'ridefood-rider',
    path: 'auth/callback',
  });

  return supabaseSignInWithGoogle({
    ...options,
    redirectTo,
    openAuthSession: (url, redirect) =>
      WebBrowser.openAuthSessionAsync(url, redirect),
  });
}
