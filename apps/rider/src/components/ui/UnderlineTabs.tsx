import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GOXE } from '../../theme/goxe';

export interface UnderlineTabOption<T extends string> {
  key: T;
  label: string;
}

export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: UnderlineTabOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            style={styles.tab}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GOXE.border,
    backgroundColor: GOXE.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: GOXE.textMuted,
    paddingBottom: 10,
  },
  labelActive: {
    color: GOXE.tealDark,
    fontWeight: '700',
  },
  underline: {
    height: 2.5,
    width: '42%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: GOXE.tealDark,
  },
});
