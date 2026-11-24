import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MenuItem, Restaurant } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../../src/providers/AppProviders';

export default function PartnerMenuScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.partner.menu();
      setRestaurant(res.data);
      setMenu(res.data.menu);
    } finally {
      setLoading(false);
    }
  }, [api.partner]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleItem = async (item: MenuItem, isAvailable: boolean) => {
    setMenu((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, isAvailable } : m)),
    );
    await api.partner.updateAvailability({ menuItemId: item.id, isAvailable });
  };

  const toggleAddon = async (itemId: string, addonId: string, isAvailable: boolean) => {
    setMenu((prev) =>
      prev.map((m) =>
        m.id !== itemId
          ? m
          : {
              ...m,
              addons: m.addons.map((a) => (a.id === addonId ? { ...a, isAvailable } : a)),
            },
      ),
    );
    await api.partner.updateAvailability({ addonId, isAvailable });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Thực đơn</Text>
      <Text style={styles.sub}>{restaurant?.name ?? 'Đang tải…'}</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={menu}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.price}>
                    {formatMoney(item.priceMinor, {
                      currency: restaurant?.currency ?? {
                        code: 'VND',
                        symbol: '₫',
                        decimalPlaces: 0,
                        name: 'VND',
                      },
                      locale: 'vi',
                    })}
                  </Text>
                </View>
                <Switch
                  value={item.isAvailable}
                  onValueChange={(v) => void toggleItem(item, v)}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                />
              </View>
              {item.addons.map((addon) => (
                <View key={addon.id} style={styles.addonRow}>
                  <Text style={styles.addonName}>
                    + {addon.name} (
                    {formatMoney(addon.priceMinor, {
                      currency: restaurant?.currency ?? {
                        code: 'VND',
                        symbol: '₫',
                        decimalPlaces: 0,
                        name: 'VND',
                      },
                      locale: 'vi',
                    })}
                    )
                  </Text>
                  <Switch
                    value={addon.isAvailable}
                    onValueChange={(v) => void toggleAddon(item.id, addon.id, v)}
                    trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                  />
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    sub: { color: theme.colors.textMuted, marginBottom: 14 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { fontWeight: '700', color: theme.colors.text, fontSize: 16 },
    price: { color: theme.colors.primary, marginTop: 2, fontWeight: '600' },
    addonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    addonName: { color: theme.colors.textMuted, flex: 1, paddingRight: 8 },
  });
}
