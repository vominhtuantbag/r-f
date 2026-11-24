import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Currency, WalletTransaction } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../src/providers/AppProviders';

export default function WalletScreen() {
  const theme = useTheme();
  const { api } = useApi();
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [currency, setCurrency] = useState<Currency>({
    code: 'VND',
    symbol: '₫',
    decimalPlaces: 0,
    name: 'VND',
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const res = await api.wallet.get();
          if (!cancelled) {
            setBalanceMinor(res.data.balanceMinor);
            setCurrency(res.data.currency);
            setTransactions(res.data.transactions);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api.wallet]),
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Text style={styles.balance}>
        {formatMoney(balanceMinor, { currency, locale: 'vi' })}
      </Text>
      <Text style={styles.sub}>Số dư khả dụng (mock)</Text>
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <Text style={{ flex: 1 }}>{item.reason}</Text>
            <Text style={{ fontWeight: '700' }}>
              {formatMoney(item.amountMinor, { currency, locale: 'vi' })}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  sub: { textAlign: 'center', opacity: 0.6, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
});