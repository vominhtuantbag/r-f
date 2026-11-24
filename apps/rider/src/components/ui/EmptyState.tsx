import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOXE } from '../../theme/goxe';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  badge?: boolean;
}

export function EmptyState({ icon, title, subtitle, style, badge = true }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      {badge ? (
        <View style={styles.badge}>
          <Ionicons name={icon} size={34} color={GOXE.teal} />
        </View>
      ) : (
        <Ionicons name={icon} size={64} color="#C5CED0" />
      )}
      <Text style={[styles.title, !badge && styles.titleMuted]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: GOXE.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: GOXE.textSub,
    textAlign: 'center',
  },
  titleMuted: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E9E9E',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: GOXE.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
