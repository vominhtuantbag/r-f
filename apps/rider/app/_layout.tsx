import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getEnv } from '@ridefood/config';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { AppProviders, useAuth, useTheme } from '../src/providers/AppProviders';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const mock = getEnv().isMockMode;

  useEffect(() => {
    if (!isReady || mock) return;
    const inAuthGroup = segments[0] === 'auth';
    // Soft guard: allow browsing tabs unauthenticated; gate booking/checkout/support.
    const protectedRoots = new Set(['ride', 'food', 'support']);
    const needsAuth = protectedRoots.has(String(segments[0]));

    if (!isAuthenticated && needsAuth && !inAuthGroup) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isReady, mock, segments, router]);

  return <>{children}</>;
}

function RootNavigator() {
  const theme = useTheme();

  return (
    <AuthGuard>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ride/book" options={{ title: 'Book ride' }} />
        <Stack.Screen name="ride/[id]/tracking" options={{ title: 'Live tracking' }} />
        <Stack.Screen name="food/restaurant/[id]" options={{ title: 'Restaurant' }} />
        <Stack.Screen name="food/checkout" options={{ title: 'Checkout' }} />
        <Stack.Screen name="support/chat" options={{ title: 'Support' }} />
        <Stack.Screen
          name="auth/login"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="auth/callback"
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack>
    </AuthGuard>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProviders>
            <RootNavigator />
          </AppProviders>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
