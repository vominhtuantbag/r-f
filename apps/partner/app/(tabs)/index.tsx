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
import type { FoodOrder, FoodOrderStatus } from '@ridefood/types';
import { MergedOrderBadge } from '@ridefood/ui';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../../src/providers/AppProviders';

const NEXT: Partial<Record<FoodOrderStatus, FoodOrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
};

const LABELS: Partial<Record<FoodOrderStatus, string>> = {
  accepted: 'Nhận đơn',
  preparing: 'Đang chế biến',
  ready: 'Sẵn sàng lấy',
};

export default function PartnerOrdersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.partner.orders();
      setOrders(res.data);
    } finally {
      setLoading(false);
    }
  }, [api.partner]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (order: FoodOrder, status: FoodOrderStatus) => {
    setBusyId(order.id);
    try {
      const res = await api.partner.updateOrderStatus(order.id, {
        status: status as 'accepted' | 'preparing' | 'ready' | 'cancelled',
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? res.data : o)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Đơn vào</Text>
      <Text style={styles.sub}>Badge gộp đơn khi cùng merged batch</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có đơn</Text>}
          renderItem={({ item }) => {
            const next = NEXT[item.status];
            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.code}>{item.code}</Text>
                  {item.mergedBatchId ? (
                    <MergedOrderBadge
                      count={orders.filter((o) => o.mergedBatchId === item.mergedBatchId).length}
                      label="Gộp"
                    />
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {item.status} ·{' '}
                  {formatMoney(item.totalMinor, { currency: item.currency, locale: 'vi' })}
                </Text>
                {item.items.map((line) => (
                  <Text key={line.id} style={styles.line}>
                    {line.quantity}× {line.name}
                  </Text>
                ))}
                <View style={styles.actions}>
                  {next ? (
                    <Pressable
                      style={styles.primary}
                      disabled={busyId === item.id}
                      onPress={() => void updateStatus(item, next)}
                    >
                      <Text style={styles.primaryLabel}>
                        {busyId === item.id ? '…' : LABELS[next] ?? next}
                      </Text>
                    </Pressable>
                  ) : null}
                  {item.status === 'pending' || item.status === 'accepted' ? (
                    <Pressable
                      style={styles.cancel}
                      disabled={busyId === item.id}
                      onPress={() => void updateStatus(item, 'cancelled')}
                    >
                      <Text style={styles.cancelLabel}>Huỷ</Text>
                    </Pressable>
                  ) : null}
                </View>
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
    sub: { color: theme.colors.textMuted, marginBottom: 14 },
    empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    code: { fontWeight: '800', fontSize: 16, color: theme.colors.text },
    meta: { color: theme.colors.textMuted, marginTop: 4 },
    line: { marginTop: 4, color: theme.colors.text },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    primary: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryLabel: { color: '#fff', fontWeight: '700' },
    cancel: {
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
    },
    cancelLabel: { color: theme.colors.danger, fontWeight: '600' },
  });
}
