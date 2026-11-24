import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GamificationProfile } from '@ridefood/types';
import { GamificationCard } from '@ridefood/ui';
import { useApi, useTheme } from '../src/providers/AppProviders';

export default function GamificationScreen() {
  const theme = useTheme();
  const { api } = useApi();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.gamification.profile();
        if (alive) setProfile(res.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.gamification]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Không tải được hồ sơ XP</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Hoàn thành chuyến / giao hàng để nhận XP. Không có tính năng AI.
      </Text>
      <GamificationCard profile={profile} />
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, gap: 12 },
    lead: { color: theme.colors.textMuted, marginBottom: 4 },
    empty: { color: theme.colors.danger },
  });
}
