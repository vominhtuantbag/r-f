import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { HomeServiceItem, ServiceAction } from '../types';
import { ServiceIcon } from './ServiceIcon';

export interface ServiceGridProps {
  items: HomeServiceItem[];
  onPressService: (id: ServiceAction) => void;
}

export function ServiceGrid({ items, onPressService }: ServiceGridProps) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560);
  const gap = 10;
  const pad = 16;
  const tileWidth = (contentWidth - pad * 2 - gap * 3) / 4;

  const rows = useMemo(() => {
    const chunk: HomeServiceItem[][] = [];
    for (let i = 0; i < items.length; i += 4) {
      chunk.push(items.slice(i, i + 4));
    }
    return chunk;
  }, [items]);

  return (
    <View style={styles.wrap}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { gap }]}>
          {row.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onPressService(item.id)}
              style={[styles.tile, { width: tileWidth }]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.iconBox, { backgroundColor: item.tint }]}>
                <ServiceIcon type={item.icon} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tile: {
    alignItems: 'center',
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#1A2B2E',
    textAlign: 'center',
    lineHeight: 16,
  },
});
