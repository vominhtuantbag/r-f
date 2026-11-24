import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GOXE } from '../../../theme/goxe';

export function BrandHeader({
  brandName,
  marketLabel,
}: {
  brandName: string;
  marketLabel: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>{brandName.toUpperCase()}</Text>
      <Text style={styles.sub}>Siêu ứng dụng tại {marketLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 14,
  },
  brand: {
    fontSize: 34,
    fontWeight: '900',
    color: GOXE.tealDark,
    letterSpacing: 1.2,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    color: GOXE.textMuted,
    fontWeight: '500',
  },
});
