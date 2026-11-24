import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Compact multi-color Google "G" mark (no SVG dependency). */
export function GoogleGMark({ size = 22 }: { size?: number }) {
  const border = Math.max(3, Math.round(size * 0.18));
  const barH = Math.max(3, Math.round(size * 0.18));
  const barW = size * 0.52;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: border,
            borderTopColor: '#EA4335',
            borderRightColor: '#4285F4',
            borderBottomColor: '#34A853',
            borderLeftColor: '#FBBC05',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            right: -border * 0.35,
            width: barW,
            height: barH,
            backgroundColor: '#4285F4',
            borderTopRightRadius: 2,
            borderBottomRightRadius: 2,
          }}
        />
        <View
          style={{
            width: size - border * 2 - 2,
            height: size - border * 2 - 2,
            borderRadius: (size - border * 2) / 2,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
