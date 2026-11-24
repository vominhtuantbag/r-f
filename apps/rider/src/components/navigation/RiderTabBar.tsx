import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GOXE } from '../../theme/goxe';

const TAB_META: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }
> = {
  index: { label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  orders: { label: 'Lịch sử', icon: 'receipt-outline', activeIcon: 'receipt' },
  cart: { label: 'Giỏ hàng', icon: 'cart-outline', activeIcon: 'cart' },
  notifications: {
    label: 'Thông báo',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
  },
  profile: { label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
};

export function RiderTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6);

  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    const href = (options as { href?: string | null } | undefined)?.href;
    if (href === null) return false;
    return Boolean(TAB_META[route.name]);
  });

  return (
    <View style={[styles.wrap, { paddingBottom: bottom }]}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;

          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === routeIndex;
          const isCenter = route.name === 'cart';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          if (isCenter) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.centerSlot}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={meta.label}
              >
                <View style={[styles.centerBtn, focused && styles.centerBtnActive]}>
                  <Ionicons name="cart" size={26} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons
                  name={focused ? meta.activeIcon : meta.icon}
                  size={22}
                  color={focused ? GOXE.tealDark : '#8A9A9E'}
                />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2EBED',
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
      },
      android: { elevation: 12 },
      web: {
        boxShadow: '0 -4px 16px rgba(8,30,34,0.08)',
      } as object,
      default: {},
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 6,
    minHeight: 58,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingBottom: 4,
  },
  iconWrap: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: GOXE.tealSoft,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A9A9E',
  },
  labelActive: {
    color: GOXE.tealDark,
    fontWeight: '700',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -22,
  },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: GOXE.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#1496A3',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
      web: {
        boxShadow: '0 6px 16px rgba(20,150,163,0.35)',
      } as object,
      default: {},
    }),
  },
  centerBtnActive: {
    backgroundColor: GOXE.tealDark,
  },
});
