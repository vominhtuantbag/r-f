import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import type { AuthSession } from '@ridefood/types';
import { getSupabase, isSupabaseMockMode } from '../client';
import { resolveUserFromSession, tokensFromSession } from './profile';

export type AuthStateListener = (payload: {
  event: AuthChangeEvent | 'MOCK_SESSION';
  session: AuthSession | null;
}) => void;

/**
 * Subscribe to Supabase auth state. In mock mode, immediately emits a null
 * session (apps seed demo users separately) and returns a no-op unsubscribe.
 */
export function onAuthStateChange(listener: AuthStateListener): {
  data: { subscription: Subscription | { unsubscribe: () => void } };
} {
  if (isSupabaseMockMode()) {
    queueMicrotask(() => listener({ event: 'MOCK_SESSION', session: null }));
    return {
      data: {
        subscription: {
          unsubscribe: () => undefined,
        },
      },
    };
  }

  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange((event, session) => {
    void (async () => {
      if (!session) {
        listener({ event, session: null });
        return;
      }
      try {
        const user = await resolveUserFromSession(session);
        listener({
          event,
          session: { user, tokens: tokensFromSession(session) },
        });
      } catch (err) {
        console.warn('[@ridefood/supabase] profile sync failed', err);
        listener({ event, session: null });
      }
    })();
  });
}

export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  if (isSupabaseMockMode()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  const user = await resolveUserFromSession(data.session);
  return { user, tokens: tokensFromSession(data.session) };
}

export async function buildAuthSessionFromSupabase(
  session: Session,
): Promise<AuthSession> {
  const user = await resolveUserFromSession(session);
  return { user, tokens: tokensFromSession(session) };
}

export async function signOut(): Promise<void> {
  if (isSupabaseMockMode()) {
    const { getMockStore } = await import('../mock');
    getMockStore().currentUserId = '';
    return;
  }
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
