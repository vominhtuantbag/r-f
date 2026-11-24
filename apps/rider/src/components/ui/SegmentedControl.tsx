import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GOXE } from '../../theme/goxe';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: GOXE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOXE.border,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: GOXE.tealDark,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: GOXE.textSub,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
