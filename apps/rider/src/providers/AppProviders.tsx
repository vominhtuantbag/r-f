import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  ApiClient,
  createApiClient,
  createRealtimeClient,
  createRideFoodApi,
  type RealtimeClient,
  type RideFoodApi,
} from '@ridefood/api';
import { createTheme, getEnv, type AppTheme } from '@ridefood/config';
import {
  demoUsers,
  diagnoseSupabaseConnection,
  fetchProfile,
  formatSupabaseDiagnostic,
  getCurrentAuthSession,
  getMockStore,
  IDS,
  onAuthStateChange,
  signOut as supabaseSignOut,
} from '@ridefood/supabase';
import type { AuthTokens, Market, User } from '@ridefood/types';
import { loadJson, loadTokens, saveJson, saveTokens, USER_KEY } from '../lib/storage';
import { setLocale } from '../lib/i18n';
import { CartProvider } from '../features/cart/CartContext';

function mockTokens(userId: string): AuthTokens {
  return {
    accessToken: `mock-access-${userId}`,
    refreshToken: `mock-refresh-${userId}`,
    tokenType: 'Bearer',
    expiresIn: 86_400,
  };
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  market: Market | null;
  isReady: boolean;
  isAuthenticated: boolean;
  setSession: (user: User, tokens: AuthTokens) => Promise<void>;
  setMarket: (market: Market | null) => void;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

interface ApiContextValue {
  client: ApiClient;
  api: RideFoodApi;
  realtime: RealtimeClient;
}

interface ThemeContextValue {
  theme: AppTheme;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ApiContext = createContext<ApiContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AppProviders');
  return ctx;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi requires AppProviders');
  return ctx;
}

export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme requires AppProviders');
  return ctx.theme;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const env = getEnv({ appVariant: 'rider' });
  const theme = useMemo(() => createTheme(), []);

  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokensState] = useState<AuthTokens | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [isReady, setIsReady] = useState(false);

  const tokenRef = React.useRef<AuthTokens | null>(null);
  tokenRef.current = tokens;

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: env.apiBaseUrl,
        locale: env.defaultLocale,
        getTokens: async () => tokenRef.current,
        setTokens: async (next) => {
          tokenRef.current = next;
          setTokensState(next);
          await saveTokens(next);
        },
        refreshTokens: async (refreshToken) => {
          const res = await createApiClient({ baseUrl: env.apiBaseUrl }).post<{
            data: AuthTokens;
          }>('/auth/refresh', { refreshToken }, false);
          return res.data;
        },
      }),
    [env.apiBaseUrl, env.defaultLocale],
  );

  const api = useMemo(() => createRideFoodApi(client), [client]);

  const realtime = useMemo(
    () =>
      createRealtimeClient({
        driver: env.isMockMode ? 'polling' : env.realtimeDriver,
        authTokenGetter: async () => tokenRef.current?.accessToken ?? null,
        poll: async (channel) => {
          try {
            const res = await client.get<{
              data: import('@ridefood/types').RealtimeEnvelope[];
            }>('/realtime/poll', { channel });
            return res.data ?? [];
          } catch {
            return [];
          }
        },
      }),
    [client, env.isMockMode, env.realtimeDriver],
  );

  const applySession = useCallback(
    async (nextUser: User, nextTokens: AuthTokens) => {
      tokenRef.current = nextTokens;
      setUser(nextUser);
      setTokensState(nextTokens);
      await Promise.all([saveTokens(nextTokens), saveJson(USER_KEY, nextUser)]);
      setLocale(nextUser.locale || env.defaultLocale);
      client.setLocale(nextUser.locale || env.defaultLocale);
    },
    [client, env.defaultLocale],
  );

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    setTokensState(null);
    await Promise.all([saveTokens(null), saveJson(USER_KEY, null)]);
  }, []);

  useEffect(() => {
    if (!env.isDev) return;
    void diagnoseSupabaseConnection()
      .then((report) => {
        console.info(formatSupabaseDiagnostic(report));
      })
      .catch((err) => {
        console.warn('[@ridefood/rider] supabase diagnostic failed', err);
      });
  }, [env.isDev]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (env.isMockMode) {
        const [storedTokens, storedUser] = await Promise.all([
          loadTokens(),
          loadJson<User>(USER_KEY),
        ]);
        if (cancelled) return;

        if (storedTokens && storedUser) {
          tokenRef.current = storedTokens;
          setTokensState(storedTokens);
          setUser(storedUser);
          getMockStore().currentUserId = storedUser.id;
          setLocale(storedUser.locale || env.defaultLocale);
          client.setLocale(storedUser.locale || env.defaultLocale);
        } else {
          const demo = demoUsers.rider;
          const seeded = mockTokens(demo.id);
          getMockStore().currentUserId = demo.id;
          tokenRef.current = seeded;
          setTokensState(seeded);
          setUser(demo);
          setLocale(demo.locale || env.defaultLocale);
          client.setLocale(demo.locale || env.defaultLocale);
          await Promise.all([saveTokens(seeded), saveJson(USER_KEY, demo)]);
        }
      } else {
        // Live Supabase: hydrate from persisted auth session + profile
        try {
          const current = await getCurrentAuthSession();
          if (!cancelled && current) {
            await applySession(current.user, current.tokens);
          } else {
            const [storedTokens, storedUser] = await Promise.all([
              loadTokens(),
              loadJson<User>(USER_KEY),
            ]);
            if (!cancelled && storedTokens && storedUser) {
              tokenRef.current = storedTokens;
              setTokensState(storedTokens);
              setUser(storedUser);
              setLocale(storedUser.locale || env.defaultLocale);
              client.setLocale(storedUser.locale || env.defaultLocale);
            }
          }
        } catch {
          // fall through unauthenticated
        }
      }

      try {
        const markets = await api.markets.list();
        const first = markets.data[0];
        if (!cancelled && first) setMarket(first);
      } catch {
        if (env.isMockMode && !cancelled) {
          setMarket({
            id: IDS.marketHcm,
            name: 'TP. Hồ Chí Minh',
            slug: 'ho-chi-minh',
            countryCode: 'VN',
            timezone: 'Asia/Ho_Chi_Minh',
            currency: {
              code: 'VND',
              symbol: '₫',
              decimalPlaces: 0,
              name: 'Vietnamese Dong',
            },
            pricingMode: 'bidding',
            otpTripStartEnabled: true,
            biddingEnabled: true,
            surgeEnabled: true,
            isActive: true,
            bounds: null,
            center: { lat: 10.7769, lng: 106.7009 },
          });
        }
      }

      if (!cancelled) {
        setIsReady(true);
        void realtime.connect();
      }
    })();
    return () => {
      cancelled = true;
      realtime.disconnect();
    };
  }, [
    api.markets,
    applySession,
    client,
    env.defaultLocale,
    env.isMockMode,
    realtime,
  ]);

  // Centralized Supabase auth state (no-op listener body in mock mode)
  useEffect(() => {
    if (env.isMockMode) return;
    const { data } = onAuthStateChange(({ session }) => {
      if (session) {
        void applySession(session.user, session.tokens);
      } else {
        void clearSession();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [applySession, clearSession, env.isMockMode]);

  const setSession = useCallback(
    async (nextUser: User, nextTokens: AuthTokens) => {
      await applySession(nextUser, nextTokens);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      await supabaseSignOut();
    } catch {
      // ignore
    }
    try {
      await api.auth.logout();
    } catch {
      // ignore network errors on logout
    }
    await clearSession();
  }, [api.auth, clearSession]);

  const refreshMe = useCallback(async () => {
    if (!env.isMockMode && user?.id) {
      try {
        const profile = await fetchProfile(user.id);
        if (profile) {
          setUser(profile);
          await saveJson(USER_KEY, profile);
          return;
        }
      } catch {
        // fall through to API
      }
    }
    const res = await api.auth.me();
    setUser(res.data);
    await saveJson(USER_KEY, res.data);
  }, [api.auth, env.isMockMode, user?.id]);

  const authValue = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      market,
      isReady,
      isAuthenticated: Boolean(user && tokens?.accessToken),
      setSession,
      setMarket,
      signOut,
      refreshMe,
    }),
    [user, tokens, market, isReady, setSession, signOut, refreshMe],
  );

  const apiValue = useMemo<ApiContextValue>(
    () => ({ client, api, realtime }),
    [client, api, realtime],
  );

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme }}>
      <ApiContext.Provider value={apiValue}>
        <AuthContext.Provider value={authValue}>
          <CartProvider>{children}</CartProvider>
        </AuthContext.Provider>
      </ApiContext.Provider>
    </ThemeContext.Provider>
  );
}
