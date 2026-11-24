import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { GeoPoint } from '@ridefood/types';
import { getEnv, defaultTheme } from '@ridefood/config';

export interface MapMarker {
  id: string;
  coordinate: GeoPoint;
  title?: string;
  description?: string;
  color?: string;
}

export interface MapViewWrapperProps {
  style?: StyleProp<ViewStyle>;
  center: GeoPoint;
  zoom?: number;
  markers?: MapMarker[];
  showsUserLocation?: boolean;
  onPress?: (point: GeoPoint) => void;
  onMarkerPress?: (markerId: string) => void;
}

export function MapViewFallback({
  style,
  center,
  zoom = 14,
  markers = [],
  onPress,
  onMarkerPress,
}: MapViewWrapperProps) {
  const env = getEnv();
  return (
    <Pressable style={[styles.fallback, style]} onPress={() => onPress?.(center)}>
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i + 1) * 14}%` }]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i + 1) * 14}%` }]} />
        ))}
        <View style={styles.roadH} />
        <View style={styles.roadV} />
        <View style={styles.centerPin}>
          <View style={styles.pinDot} />
          <Text style={styles.pinLabel}>You</Text>
        </View>
        {markers.map((m, idx) => (
          <Pressable
            key={m.id}
            style={[
              styles.markerChip,
              {
                top: `${28 + (idx % 3) * 18}%`,
                left: `${22 + (idx % 4) * 16}%`,
                backgroundColor: m.color ?? defaultTheme.colors.primary,
              },
            ]}
            onPress={() => onMarkerPress?.(m.id)}
          >
            <Text style={styles.markerText} numberOfLines={1}>
              {m.title ?? m.id}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.metaBar}>
        <Text style={styles.fallbackTitle}>Map preview</Text>
        <Text style={styles.fallbackMeta}>
          {center.lat.toFixed(4)}, {center.lng.toFixed(4)} · z{zoom}
        </Text>
        {!env.googleMapsApiKey ? (
          <Text style={styles.hint}>Mock map — set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY on native builds</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#DCEEEF',
    overflow: 'hidden',
    borderRadius: defaultTheme.radii.md,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#C5E4E7',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  roadH: {
    position: 'absolute',
    top: '48%',
    left: '8%',
    right: '8%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  roadV: {
    position: 'absolute',
    left: '42%',
    top: '12%',
    bottom: '18%',
    width: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  centerPin: {
    position: 'absolute',
    top: '44%',
    left: '46%',
    alignItems: 'center',
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: defaultTheme.colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: defaultTheme.colors.text,
  },
  markerChip: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 120,
  },
  markerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  metaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  fallbackTitle: {
    fontSize: defaultTheme.typography.sizes.sm,
    fontWeight: defaultTheme.typography.weights.bold,
    color: defaultTheme.colors.text,
  },
  fallbackMeta: {
    color: defaultTheme.colors.textMuted,
    fontSize: defaultTheme.typography.sizes.xs,
  },
  hint: {
    color: defaultTheme.colors.warning,
    marginTop: 2,
    fontSize: defaultTheme.typography.sizes.xs,
  },
});
