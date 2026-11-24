import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PaymentMethod, PromoCode } from '@ridefood/types';
import { getEnv } from '@ridefood/config';
import { calculateCheckoutTotals, formatMoney } from '@ridefood/utils';
import { useApi, useAuth, useTheme } from '../../src/providers/AppProviders';

interface CartParamItem {
  menuItemId: string;
  quantity: number;
  variantId?: string | null;
  addonIds?: string[];
}

export default function FoodCheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    restaurantId: string;
    zoneId: string;
    cart: string;
    subtotal: string;
    currencyCode: string;
    freeDelivery?: string;
  }>();
  const { api } = useApi();
  const { market } = useAuth();
  const env = getEnv();

  const cart = useMemo<CartParamItem[]>(() => {
    try {
      return JSON.parse(params.cart ?? '[]') as CartParamItem[];
    } catch {
      return [];
    }
  }, [params.cart]);

  const currency = market?.currency ?? {
    code: params.currencyCode || env.defaultCurrency,
    symbol: '$',
    decimalPlaces: 2,
    name: params.currencyCode || 'USD',
  };

  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const subtotalMinor = Number(params.subtotal || 0);
  const deliveryFeeMinor = params.freeDelivery === '1' ? 0 : 1500;

  const totals = calculateCheckoutTotals({
    subtotalMinor,
    deliveryFeeMinor,
    promo,
    subscription: null,
    currency,
    context: 'food',
  });

  const applyPromo = async () => {
    setError(null);
    try {
      const res = await api.promos.validate({
        code: promoCode.trim(),
        appliesContext: 'food',
        marketId: market?.id ?? '',
        zoneId: params.zoneId,
        subtotalMinor,
      });
      if (!res.data.valid || !res.data.promo) {
        setPromo(null);
        setError(res.data.message ?? 'Invalid promo');
        return;
      }
      setPromo(res.data.promo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promo failed');
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.food.placeOrder({
        restaurantId: params.restaurantId,
        zoneId: params.zoneId,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          variantId: c.variantId ?? null,
          addonIds: c.addonIds ?? [],
        })),
        deliveryAddress: address || 'Delivery address',
        deliveryPoint: market?.center ?? { lat: 0, lng: 0 },
        paymentMethod,
        promoCode: promo?.code,
      });
      router.replace('/(tabs)/orders');
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const methods: PaymentMethod[] = [
    'wallet',
    'cash',
    'stripe',
    'paypal',
    'razorpay',
    'myfatoorah',
  ];

  const gatewayHint = (m: PaymentMethod): string | null => {
    if (m === 'stripe' && !env.payments.stripePublishableKey) return 'Add Stripe pk';
    if (m === 'paypal' && !env.payments.paypalClientId) return 'Add PayPal client id';
    if (m === 'razorpay' && !env.payments.razorpayKeyId) return 'Add Razorpay key';
    if (m === 'myfatoorah' && !env.payments.myFatoorahPublicKey) return 'Add MyFatoorah key';
    return null;
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Delivery address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Building, street, area"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.section}>Promo code</Text>
      <View style={styles.promoRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          placeholder="SAVE10"
          placeholderTextColor={theme.colors.textMuted}
        />
        <Pressable style={styles.secondary} onPress={() => void applyPromo()}>
          <Text style={styles.secondaryLabel}>Apply</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Pay with</Text>
      <View style={styles.methods}>
        {methods.map((m) => {
          const hint = gatewayHint(m);
          return (
            <Pressable
              key={m}
              style={[styles.method, paymentMethod === m && styles.methodActive]}
              onPress={() => setPaymentMethod(m)}
            >
              <Text
                style={[
                  styles.methodLabel,
                  paymentMethod === m && styles.methodLabelActive,
                ]}
              >
                {m}
              </Text>
              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.summary, theme.shadow(2)]}>
        <Row label="Subtotal" value={formatMoney(totals.subtotalMinor, { currency })} theme={theme} />
        <Row
          label="Delivery"
          value={
            params.freeDelivery === '1' || totals.deliveryFeeMinor === 0
              ? 'Free'
              : formatMoney(totals.deliveryFeeMinor, { currency })
          }
          theme={theme}
        />
        {totals.promoDiscountMinor > 0 ? (
          <Row
            label="Promo"
            value={`−${formatMoney(totals.promoDiscountMinor, { currency })}`}
            theme={theme}
          />
        ) : null}
        <Row
          label="Total"
          value={formatMoney(totals.totalMinor, { currency })}
          theme={theme}
          bold
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={() => void placeOrder()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.primaryLabel}>Place order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  theme,
  bold,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: theme.colors.textMuted, fontWeight: bold ? '700' : '500' }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.text, fontWeight: bold ? '700' : '600' }}>{value}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 40 },
    section: { fontWeight: '700', color: theme.colors.text, marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    promoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    secondary: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    secondaryLabel: { color: theme.colors.primary, fontWeight: '700' },
    methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    method: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.surface,
      minWidth: '30%',
    },
    methodActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.bidHighlight,
    },
    methodLabel: { textTransform: 'capitalize', color: theme.colors.text, fontWeight: '600' },
    methodLabelActive: { color: theme.colors.primary },
    hint: { fontSize: 10, color: theme.colors.warning, marginTop: 2 },
    summary: {
      marginTop: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    primary: {
      marginTop: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryLabel: { color: theme.colors.textInverse, fontWeight: '700' },
    error: { color: theme.colors.danger },
  });
}
