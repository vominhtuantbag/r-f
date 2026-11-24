import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HomeVoucherBanner } from '../types';

export interface VoucherBannerCardProps {
  voucher: HomeVoucherBanner;
  onPress?: () => void;
}

export function VoucherBannerCard({ voucher, onPress }: VoucherBannerCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{voucher.eyebrow}</Text>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="ticket" size={22} color="#24B8C4" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{voucher.title}</Text>
          <Text style={styles.subtitle}>{voucher.subtitle}</Text>
        </View>
        <Pressable style={styles.cta} onPress={onPress} accessibilityRole="button">
          <Text style={styles.ctaLabel}>{voucher.ctaLabel} →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#E7F7F9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C8EBEF',
  },
  eyebrow: {
    color: '#1BA8B5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A2B2E',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7C80',
  },
  cta: {
    backgroundColor: '#24B8C4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
