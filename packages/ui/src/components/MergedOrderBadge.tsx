import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { defaultTheme } from '@ridefood/config';

export interface MergedOrderBadgeProps {
  count: number;
  label?: string;
  compact?: boolean;
}

export function MergedOrderBadge({
  count,
  label = 'Merged',
  compact = false,
}: MergedOrderBadgeProps) {
  if (count <= 1) return null;

  return (
    <View style={[styles.badge, compact && styles.compact]}>
      <Text style={styles.label}>
        {label} ×{count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: defaultTheme.colors.info,
    paddingHorizontal: defaultTheme.spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: defaultTheme.radii.sm,
  },
  compact: {
    paddingHorizontal: defaultTheme.spacing.sm,
    paddingVertical: 2,
  },
  label: {
    color: defaultTheme.colors.textInverse,
    fontSize: defaultTheme.typography.sizes.xs,
    fontWeight: defaultTheme.typography.weights.semibold,
    letterSpacing: 0.3,
  },
});
