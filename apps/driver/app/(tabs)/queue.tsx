import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FoodOrder, MergedOrderBatch } from '@ridefood/types';
import { MergedOrderBadge } from '@ridefood/ui';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../../src/providers/AppProviders';

export default function DeliveryQueueScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const [batches, setBatches] = useState<MergedOrderBatch[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRes, orderRes] = await Promise.all([
        api.merging.driverQueue(),
        api.food.orders(),
      ]);
      setBatches(batchRes.data);
      setOrders(orderRes.data);
    } finally {
      setLoading(false);
    }
  }, [api.food, api.merging]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Hàng đợi giao đồ ăn</Text>
      <Text style={styles.sub}>Merged batches + đơn lẻ (mock VN data)</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              {orders
                .filter((o) => !o.mergedBatchId && ['ready', 'preparing', 'accepted'].includes(o.status))
                .map((o) => (
                  <View key={o.id} style={styles.card}>
                    <Text style={styles.code}>{o.code}</Text>
                    <Text style={styles.meta}>
                      {o.status} · {formatMoney(o.totalMinor, { currency: o.currency, locale: 'vi' })}
                    </Text>
                    <Text style={styles.addr}>{o.deliveryAddress}</Text>
                  </View>
                ))}
            </View>
          }
          ListEmptyComponent={
            batches.length === 0 ? (
              <Text style={styles.empty}>Không có batch. Kéo để làm mới sau khi partner sẵn sàng.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const batchOrders = orders.filter((o) => item.orderIds.includes(o.id));
            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.code}>Batch {item.id.slice(-6)}</Text>
                  <MergedOrderBadge count={item.orderIds.length} label="Gộp đơn" />
                </View>
                <Text style={styles.meta}>
                  {item.status} · tối đa {item.maxOrders} đơn
                </Text>
                {batchOrders.map((o) => (
                  <Text key={o.id} style={styles.orderLine}>
                    • {o.code} — {o.status} —{' '}
                    {formatMoney(o.totalMinor, { currency: o.currency, locale: 'vi' })}
                  </Text>
                ))}
                <Pressable style={styles.refresh} onPress={() => void load()}>
                  <Text style={styles.refreshLabel}>Làm mới</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    sub: { color: theme.colors.textMuted, marginBottom: 16 },
    empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    code: { fontWeight: '700', color: theme.colors.text, fontSize: 16 },
    meta: { color: theme.colors.textMuted, marginTop: 4 },
    addr: { marginTop: 6, color: theme.colors.text },
    orderLine: { marginTop: 6, color: theme.colors.text, fontSize: 13 },
    refresh: {
      marginTop: 12,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    refreshLabel: { color: theme.colors.primary, fontWeight: '700' },
  });
}
