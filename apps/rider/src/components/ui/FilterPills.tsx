import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { GOXE } from '../../theme/goxe';

export interface FilterPillOption<T extends string> {
  key: T;
  label: string;
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GOXE.surface,
    borderWidth: 1,
    borderColor: GOXE.border,
  },
  pillActive: {
    backgroundColor: GOXE.tealDark,
    borderColor: GOXE.tealDark,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: GOXE.textSub,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
