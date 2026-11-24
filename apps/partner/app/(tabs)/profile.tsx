import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useTheme } from '../../src/providers/AppProviders';

export default function PartnerProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, market, signOut } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Cửa hàng đối tác</Text>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.meta}>{user?.phone}</Text>
      <Text style={styles.meta}>Thị trường: {market?.name ?? '—'}</Text>
      <Text style={styles.hint}>LOCAL_MOCK_MODE — Phở Bà Năm seed data</Text>

      <Pressable style={styles.btn} onPress={() => void signOut()}>
        <Text style={styles.btnLabel}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, gap: 6 },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    name: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
    meta: { color: theme.colors.textMuted },
    hint: { marginTop: 8, color: theme.colors.info },
    btn: {
      marginTop: 24,
      backgroundColor: theme.colors.danger,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnLabel: { color: '#fff', fontWeight: '700' },
  });
}
