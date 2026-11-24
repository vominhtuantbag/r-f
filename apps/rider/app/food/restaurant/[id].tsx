import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MenuItem, Restaurant } from '@ridefood/types';
import { formatMoney, isSubscriptionFreeDeliveryEligible } from '@ridefood/utils';
import { useApi, useAuth, useTheme } from '../../../src/providers/AppProviders';
import { useCart } from '../../../src/features/cart/CartContext';

interface CartLine {
  menuItem: MenuItem;
  quantity: number;
  addonIds: string[];
  variantId: string | null;
}

export default function RestaurantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useApi();
  const { isAuthenticated } = useAuth();
  const globalCart = useCart();
  const [restaurant, setRestaurant] = useState<(Restaurant & { menu: MenuItem[] }) | null>(
    null,
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.food.restaurant(id);
        if (!alive) return;
        setRestaurant({ ...res.data, menu: res.data.menu });
        if (isAuthenticated) {
          try {
            const sub = await api.subscriptions.current();
            setFreeDelivery(isSubscriptionFreeDeliveryEligible(sub.data));
          } catch {
            setFreeDelivery(false);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.food, api.subscriptions, id, isAuthenticated]);

  const subtotal = cart.reduce((sum, line) => {
    const addonTotal = line.menuItem.addons
      .filter((a) => line.addonIds.includes(a.id))
      .reduce((s, a) => s + a.priceMinor, 0);
    const variantDelta =
      line.menuItem.variants.find((v) => v.id === line.variantId)?.priceDeltaMinor ?? 0;
    return sum + (line.menuItem.priceMinor + addonTotal + variantDelta) * line.quantity;
  }, 0);

  const addItem = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItem.id === item.id && !l.variantId);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { menuItem: item, quantity: 1, addonIds: [], variantId: null }];
    });
    if (restaurant) {
      globalCart.addLine({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        unitPriceMinor: item.priceMinor,
        addonNames: [],
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Restaurant unavailable</Text>
      </View>
    );
  }

  const money = (amount: number) => formatMoney(amount, { currency: restaurant.currency });

  return (
    <View style={styles.root}>
      <FlatList
        data={restaurant.menu}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{restaurant.name}</Text>
            <Text style={styles.sub}>
              {restaurant.currency.code} · zone pricing · ETA {restaurant.etaMinutes} min
            </Text>
            {freeDelivery ? (
              <Text style={styles.perk}>Free delivery with your membership</Text>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, !item.isAvailable && styles.disabled]}
            disabled={!item.isAvailable}
            onPress={() => addItem(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? <Text style={styles.sub}>{item.description}</Text> : null}
            </View>
            <Text style={styles.price}>{money(item.priceMinor)}</Text>
          </Pressable>
        )}
      />

      {cart.length > 0 ? (
        <View style={[styles.cartBar, theme.shadow(4)]}>
          <Text style={styles.cartMeta}>
            {cart.reduce((n, l) => n + l.quantity, 0)} items · {money(subtotal)}
          </Text>
          <Pressable style={styles.checkout} onPress={() => router.push('/(tabs)/cart')}>
            <Text style={styles.checkoutLabel}>Xem giỏ hàng</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: theme.spacing.md, paddingBottom: 120 },
    header: { marginBottom: theme.spacing.md, gap: 4 },
    title: {
      fontSize: theme.typography.sizes.xxl,
      fontWeight: '700',
      color: theme.colors.text,
    },
    sub: { color: theme.colors.textMuted },
    perk: { color: theme.colors.success, fontWeight: '600', marginTop: 4 },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },
    disabled: { opacity: 0.45 },
    itemName: { fontWeight: '700', color: theme.colors.text },
    price: { fontWeight: '700', color: theme.colors.primary },
    cartBar: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cartMeta: { fontWeight: '600', color: theme.colors.text },
    checkout: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.radii.md,
    },
    checkoutLabel: { color: theme.colors.textInverse, fontWeight: '700' },
    error: { color: theme.colors.danger },
  });
}
