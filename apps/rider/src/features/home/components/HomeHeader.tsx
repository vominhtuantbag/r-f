import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export interface HomeHeaderProps {
  locationCaption: string;
  locationLabel: string;
  promoCount: number;
  searchPlaceholder: string;
  onMenuPress?: () => void;
  onLocationPress?: () => void;
  onPromoPress?: () => void;
  onSearchPress?: () => void;
}

export function HomeHeader({
  locationCaption,
  locationLabel,
  promoCount,
  searchPlaceholder,
  onMenuPress,
  onLocationPress,
  onPromoPress,
  onSearchPress,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'web' ? 16 : 8);

  return (
    <LinearGradient
      colors={['#24B8C4', '#1BA8B5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { paddingTop: topPad + 8 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftCluster}>
          <Pressable
            onPress={onMenuPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Mở menu"
            style={styles.menuBtn}
          >
            <Ionicons name="menu" size={26} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={onLocationPress}
            style={styles.locationBlock}
            accessibilityRole="button"
            accessibilityLabel={`Địa điểm ${locationLabel}`}
          >
            <Text style={styles.locationCaption}>{locationCaption}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel} numberOfLines={1}>
                {locationLabel}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={onPromoPress}
          style={styles.promoPill}
          accessibilityRole="button"
          accessibilityLabel={`${promoCount} ưu đãi`}
        >
          <View style={styles.promoIcon}>
            <Ionicons name="gift" size={14} color="#E67E22" />
          </View>
          <View>
            <Text style={styles.promoTitle}>{promoCount} ưu đãi</Text>
            <Text style={styles.promoSub}>Bạn có thể sử dụng</Text>
          </View>
        </Pressable>
      </View>

      <Pressable
        onPress={onSearchPress}
        style={styles.search}
        accessibilityRole="search"
        accessibilityLabel={searchPlaceholder}
      >
        <Ionicons name="search" size={18} color="#6B7C80" />
        <Text style={styles.searchPlaceholder} numberOfLines={1}>
          {searchPlaceholder}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  locationCaption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 160,
  },
  promoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  promoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: {
    color: '#1A2B2E',
    fontSize: 12,
    fontWeight: '700',
  },
  promoSub: {
    color: '#6B7C80',
    fontSize: 9,
    fontWeight: '500',
  },
  search: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 14 : 12,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#8A9A9E',
    fontSize: 14,
  },
});
