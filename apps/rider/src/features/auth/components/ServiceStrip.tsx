import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOXE } from '../../../theme/goxe';

const SERVICES: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'ride', label: 'Đặt xe', icon: 'car-outline' },
  { key: 'food', label: 'Đặt đồ ăn', icon: 'restaurant-outline' },
  { key: 'parcel', label: 'Giao hàng', icon: 'cube-outline' },
  { key: 'truck', label: 'Xe tải', icon: 'bus-outline' },
];

export function ServiceStrip() {
  return (
    <View style={styles.card}>
      {SERVICES.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.item}>
            <Ionicons name={s.icon} size={22} color={GOXE.tealDark} />
            <Text style={styles.label}>{s.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: GOXE.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 6px 18px rgba(8,30,34,0.08)' } as object,
      default: {},
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: GOXE.border,
    marginVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: GOXE.tealDark,
  },
});
