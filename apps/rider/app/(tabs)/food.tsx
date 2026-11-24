import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Restaurant } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { useApi, useAuth, useTheme } from '../../src/providers/AppProviders';
import { t } from '../../src/lib/i18n';

export default function FoodDiscoveryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const { market } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    if (!market?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.food.restaurants({
        marketId: market.id,
        q: query || undefined,
        page: 1,
      });
      setRestaurants(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [api.food, market?.id, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>{t('food.title')}</Text>
      <Text style={styles.perk}>{t('food.freeDelivery')}</Text>
      <TextInput
        style={styles.search}
        placeholder={t('food.search')}
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void load()}
        returnKeyType="search"
      />

      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {market ? 'No restaurants in this zone yet.' : 'Select a market from Rides first.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, theme.shadow(2)]}
            onPress={() =>
              router.push({
                pathname: '/food/restaurant/[id]',
                params: { id: item.id },
              })
            }
          >
            {item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]} />
            )}
            <View style={styles.meta}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                ★ {item.ratingAvg.toFixed(1)} · {item.etaMinutes} min ·{' '}
                {formatMoney(0, { currency: item.currency }).replace(/[\d.,]+/g, '').trim() ||
                  item.currency.code}
              </Text>
              <Text style={styles.status}>{item.isOpen ? 'Open' : 'Closed'}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
    title: {
      fontSize: theme.typography.sizes.xxl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
    },
    perk: {
      color: theme.colors.primary,
      marginBottom: theme.spacing.sm,
      fontWeight: theme.typography.weights.medium,
    },
    search: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    list: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    cover: { width: '100%', height: 120 },
    coverFallback: { backgroundColor: theme.colors.surfaceMuted },
    meta: { padding: theme.spacing.md },
    name: {
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
    },
    sub: { color: theme.colors.textMuted, marginTop: 4 },
    status: { marginTop: 6, color: theme.colors.success, fontWeight: '600' },
    empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
    error: { color: theme.colors.danger, marginBottom: 8 },
  });
}
