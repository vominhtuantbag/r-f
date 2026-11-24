import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Currency, WalletTransaction } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../../src/providers/AppProviders';

export default function EarningsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState<Currency>({
    code: 'VND',
    symbol: '₫',
    decimalPlaces: 0,
    name: 'Vietnamese Dong',
  });
  const [tx, setTx] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.wallet.get();
      setBalance(res.data.balanceMinor);
      setCurrency(res.data.currency);
      setTx(res.data.transactions);
    } finally {
      setLoading(false);
    }
  }, [api.wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Ví & thu nhập</Text>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.balance}>
            {formatMoney(balance, { currency, locale: 'vi' })}
          </Text>
        )}
      </View>
      <Text style={styles.section}>Giao dịch gần đây</Text>
      <FlatList
        data={tx}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có giao dịch</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reason}>{item.reason}</Text>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleString('vi-VN')}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                { color: item.type === 'credit' ? theme.colors.success : theme.colors.danger },
              ]}
            >
              {item.type === 'credit' ? '+' : '−'}
              {formatMoney(item.amountMinor, { currency: item.currency, locale: 'vi' })}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
    balanceCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    },
    balanceLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    balance: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
    section: { fontWeight: '700', fontSize: 16, color: theme.colors.text, marginBottom: 8 },
    empty: { color: theme.colors.textMuted, marginTop: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
    reason: { fontWeight: '600', color: theme.colors.text },
    date: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    amount: { fontWeight: '700' },
  });
}
