import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AuthTab } from '../types';
import { GOXE } from '../../../theme/goxe';

export function AuthTabs({
  value,
  onChange,
}: {
  value: AuthTab;
  onChange: (tab: AuthTab) => void;
}) {
  return (
    <View style={styles.row}>
      {(
        [
          { key: 'login', label: 'Đăng nhập' },
          { key: 'register', label: 'Đăng ký' },
        ] as const
      ).map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
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
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: GOXE.textMuted,
    paddingBottom: 10,
  },
  labelActive: {
    color: GOXE.tealDark,
    fontWeight: '800',
  },
  underline: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: GOXE.tealDark,
  },
});
