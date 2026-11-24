import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useTheme } from '../../src/providers/AppProviders';

export default function DriverProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, online, signOut } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Tài khoản tài xế</Text>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.meta}>{user?.phone}</Text>
      <Text style={styles.meta}>Trạng thái: {online ? 'Online' : 'Offline'}</Text>

      <Pressable style={styles.btn} onPress={() => router.push('/gamification')}>
        <Text style={styles.btnLabel}>XP · Level · Huy hiệu</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, styles.danger]}
        onPress={() => void signOut()}
      >
        <Text style={styles.btnLabel}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, gap: 8 },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    name: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
    meta: { color: theme.colors.textMuted },
    btn: {
      marginTop: 16,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    danger: { backgroundColor: theme.colors.danger },
    btnLabel: { color: '#fff', fontWeight: '700' },
  });
}
