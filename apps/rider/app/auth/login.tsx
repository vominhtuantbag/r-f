import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEnv } from '@ridefood/config';
import {
  signInWithPhonePassword,
  signUpRider,
} from '@ridefood/supabase';
import { AuthTabs } from '../../src/features/auth/components/AuthTabs';
import { BrandHeader } from '../../src/features/auth/components/BrandHeader';
import { LoginForm } from '../../src/features/auth/components/LoginForm';
import { RegisterForm } from '../../src/features/auth/components/RegisterForm';
import { ServiceStrip } from '../../src/features/auth/components/ServiceStrip';
import { TrustFooter } from '../../src/features/auth/components/TrustFooter';
import { signInWithGoogle } from '../../src/features/auth/signInWithGoogle';
import type { AuthMarketOption, AuthTab } from '../../src/features/auth/types';
import { useApi, useAuth } from '../../src/providers/AppProviders';
import { GOXE } from '../../src/theme/goxe';

function authErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function parseTab(raw: string | string[] | undefined): AuthTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'register' || value === 'signup' ? 'register' : 'login';
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();
  const env = getEnv({ appVariant: 'rider' });
  const { api } = useApi();
  const { setSession, setMarket, market } = useAuth();

  const [tab, setTab] = useState<AuthTab>(() => parseTab(params.tab));
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<AuthMarketOption[]>([
    { id: 'song-doc', label: 'Sông Đốc, Cà Mau' },
  ]);
  const [selectedMarketId, setSelectedMarketId] = useState('song-doc');

  const contentMax = Math.min(width, 480);
  const versionLabel = useMemo(() => {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const build =
      Constants.nativeBuildVersion ??
      Constants.expoConfig?.android?.versionCode ??
      Constants.expoConfig?.ios?.buildNumber ??
      '279';
    return `v${version} (${build})`;
  }, []);

  const marketLabel = useMemo(() => {
    const selected = markets.find((m) => m.id === selectedMarketId);
    if (selected) {
      return selected.label.split(',')[0]?.trim() || selected.label;
    }
    return market?.name ?? 'Sông Đốc';
  }, [market?.name, markets, selectedMarketId]);

  useEffect(() => {
    setTab(parseTab(params.tab));
  }, [params.tab]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.markets.list();
        if (!alive || !res.data.length) return;
        const options = res.data.map((m) => ({
          id: m.id,
          label: m.slug.includes('ho-chi-minh')
            ? `${m.name}`
            : m.name.includes(',')
              ? m.name
              : `${m.name}`,
        }));
        // Prefer a friendly Song Doc option first for brand copy, then API markets
        const merged: AuthMarketOption[] = [
          { id: 'song-doc', label: 'Sông Đốc, Cà Mau' },
          ...options.filter((o) => o.id !== 'song-doc'),
        ];
        setMarkets(merged);
        if (!merged.some((m) => m.id === selectedMarketId)) {
          setSelectedMarketId(merged[0]!.id);
        }
        if (!market && res.data[0]) setMarket(res.data[0]);
      } catch {
        // keep Song Doc fallback
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.markets, market, selectedMarketId, setMarket]);

  const switchTab = useCallback(
    (next: AuthTab) => {
      setError(null);
      setTab(next);
      router.setParams({ tab: next === 'register' ? 'register' : 'login' });
    },
    [router],
  );

  const onLogin = useCallback(
    async (payload: { phone: string; password: string }) => {
      setLoading(true);
      setError(null);
      try {
        const session = await signInWithPhonePassword({
          phone: payload.phone,
          password: payload.password,
          role: 'rider',
        });
        await setSession(session.user, session.tokens);
        router.replace('/(tabs)');
      } catch (e) {
        setError(authErrorMessage(e, 'Đăng nhập thất bại'));
      } finally {
        setLoading(false);
      }
    },
    [router, setSession],
  );

  const onRegister = useCallback(
    async (payload: {
      fullName: string;
      phone: string;
      password: string;
      marketId: string;
      referralCode?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const parts = payload.fullName.trim().split(/\s+/);
        const firstName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]!;
        const lastName = parts.length > 1 ? parts[0]! : '';
        const result = await signUpRider({
          phone: payload.phone,
          firstName,
          lastName,
          fullName: payload.fullName,
          password: payload.password,
          marketId: payload.marketId === 'song-doc' ? undefined : payload.marketId,
          locale: 'vi',
          referralCode: payload.referralCode,
        });

        if (result.status === 'confirmation_required') {
          setError(result.message);
          Alert.alert('Xác minh tài khoản', result.message);
          switchTab('login');
          return;
        }

        await setSession(result.session.user, result.session.tokens);
        router.replace('/(tabs)');
      } catch (e) {
        setError(authErrorMessage(e, 'Đăng ký thất bại'));
      } finally {
        setLoading(false);
      }
    },
    [router, setSession, switchTab],
  );

  const onGoogle = useCallback(async () => {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const marketId =
        selectedMarketId === 'song-doc' ? undefined : selectedMarketId;
      const result = await signInWithGoogle({
        role: 'rider',
        marketId,
      });
      await setSession(result.session.user, result.session.tokens);
      router.replace('/(tabs)');
    } catch (e) {
      const message = authErrorMessage(e, 'Đăng nhập Google thất bại');
      if (!/hủy|cancel/i.test(message)) {
        setError(message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLoading, loading, router, selectedMarketId, setSession]);

  return (
    <LinearGradient
      colors={['#E8F7F8', '#F7FBFC', '#FFFFFF']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.column, { maxWidth: contentMax }]}>
            <BrandHeader brandName={env.brandName} marketLabel={marketLabel} />
            <ServiceStrip />

            <View style={styles.card}>
              <AuthTabs value={tab} onChange={switchTab} />
              {tab === 'login' ? (
                <LoginForm
                  loading={loading}
                  googleLoading={googleLoading}
                  error={error}
                  onSubmit={onLogin}
                  onGoogle={() => void onGoogle()}
                  onForgotPassword={() =>
                    Alert.alert(
                      'Quên mật khẩu',
                      `Vui lòng gọi hotline ${GOXE.hotline} để được hỗ trợ đặt lại mật khẩu.`,
                      [
                        { text: 'Đóng', style: 'cancel' },
                        {
                          text: 'Gọi ngay',
                          onPress: () => void Linking.openURL(`tel:${GOXE.hotline}`),
                        },
                      ],
                    )
                  }
                />
              ) : (
                <RegisterForm
                  brandName={env.brandName}
                  markets={markets}
                  selectedMarketId={selectedMarketId}
                  onSelectMarket={setSelectedMarketId}
                  loading={loading}
                  googleLoading={googleLoading}
                  error={error}
                  onSubmit={onRegister}
                  onGoogle={() => void onGoogle()}
                />
              )}
            </View>

            <TrustFooter
              tab={tab}
              onSwitchTab={switchTab}
              versionLabel={versionLabel}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  column: {
    width: '100%',
    gap: 14,
  },
  card: {
    marginTop: 4,
    backgroundColor: GOXE.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 10px 28px rgba(8,30,34,0.1)' } as object,
      default: {},
    }),
  },
});
