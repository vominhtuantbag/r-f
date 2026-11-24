import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GOXE } from '../../../theme/goxe';

export function OrDivider({ label = 'hoặc' }: { label?: string }) {
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOXE.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: GOXE.textMuted,
    textTransform: 'lowercase',
  },
});
