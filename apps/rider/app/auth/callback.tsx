import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { completeGoogleOAuthFromRedirectUrl } from '@ridefood/supabase';
import { useAuth } from '../../src/providers/AppProviders';
import { GOXE } from '../../src/theme/goxe';

/**
 * OAuth redirect landing (Web deep-link / native scheme `ridefood-rider://auth/callback`).
 * Completes Supabase Google session when not in mock mode.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          router.replace('/auth/login');
          return;
        }
        const session = await completeGoogleOAuthFromRedirectUrl(url, {
          role: 'rider',
        });
        if (!alive) return;
        await setSession(session.user, session.tokens);
        router.replace('/(tabs)');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Không hoàn tất đăng nhập Google');
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, setSession]);

  return (
    <View style={styles.wrap}>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.link} onPress={() => router.replace('/auth/login')}>
            Quay lại đăng nhập
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={GOXE.tealDark} size="large" />
          <Text style={styles.caption}>Đang hoàn tất đăng nhập Google…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7FBFC',
    gap: 12,
  },
  caption: { color: GOXE.textSub, fontSize: 14 },
  error: { color: GOXE.danger, fontWeight: '700', textAlign: 'center' },
  link: { color: GOXE.tealDark, fontWeight: '700' },
});
