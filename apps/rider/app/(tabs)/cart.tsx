import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEnv } from '@ridefood/config';
import { calculateCheckoutTotals, formatMoney } from '@ridefood/utils';
import { useCart } from '../../src/features/cart/CartContext';
import { GOXE } from '../../src/theme/goxe';

const VND = {
  code: 'VND',
  symbol: '₫',
  decimalPlaces: 0,
  name: 'Vietnamese Dong',
} as const;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const env = getEnv();
  const { lines, subtotalMinor, setQuantity, clear, itemCount } = useCart();
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  const totals = useMemo(() => {
    return calculateCheckoutTotals({
      subtotalMinor,
      deliveryFeeMinor: 15_000,
      promo: promoApplied
        ? {
            id: 'local-promo',
            code: promo || 'GOXE20',
            discountType: 'percentage',
            discountValue: 20,
            appliesTo: 'food',
            marketIds: [],
            zoneIds: [],
            maxTotalUses: null,
            maxUsesPerUser: 5,
            usedCount: 0,
            minOrderMinor: 0,
            maxDiscountMinor: 50_000,
            startsAt: new Date(0).toISOString(),
            expiresAt: new Date(Date.now() + 86400_000).toISOString(),
            isActive: true,
          }
        : null,
      subscription: {
        id: 'local-sub',
        userId: 'local',
        planId: 'plan',
        plan: {
          id: 'plan',
          name: `${env.brandName} Plus`,
          interval: 'monthly',
          priceMinor: 99_000,
          currency: VND,
          rideDiscountPercent: 10,
          freeFoodDelivery: true,
          freeDeliveryMaxOrdersPerMonth: 30,
          marketIds: [],
          isActive: true,
          features: [],
        },
        status: 'active',
        currentPeriodStart: new Date(0).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 86400_000).toISOString(),
        cancelAtPeriodEnd: false,
        freeDeliveryUsedThisPeriod: 0,
      },
      currency: VND,
      context: 'food',
    });
  }, [env.brandName, promo, promoApplied, subtotalMinor]);

  const money = (minor: number) =>
    formatMoney(minor, { currency: VND, locale: 'vi-VN' }).replace('₫', 'đ');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={22} color={GOXE.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.headerSpacer} />
      </View>

      {itemCount === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={64} color="#C5CED0" />
          <Text style={styles.emptyLabel}>Giỏ hàng trống</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)/food')}>
            <Text style={styles.browseLabel}>Khám phá đồ ăn</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.restaurant}>{lines[0]?.restaurantName ?? 'Quán'}</Text>
          {lines.map((line) => (
            <View key={line.id} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>
                  {line.quantity}× {line.name}
                </Text>
                {line.addonNames.length ? (
                  <Text style={styles.addons}>{line.addonNames.join(', ')}</Text>
                ) : null}
                <Text style={styles.linePrice}>{money(line.unitPriceMinor * line.quantity)}</Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(line.id, line.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={GOXE.tealDark} />
                </Pressable>
                <Text style={styles.qty}>{line.quantity}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(line.id, line.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={GOXE.tealDark} />
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Mã khuyến mãi"
              placeholderTextColor={GOXE.textMuted}
              value={promo}
              onChangeText={setPromo}
              autoCapitalize="characters"
            />
            <Pressable
              style={styles.promoBtn}
              onPress={() => setPromoApplied(Boolean(promo.trim()) || true)}
            >
              <Text style={styles.promoBtnLabel}>Áp dụng</Text>
            </Pressable>
          </View>

          <View style={styles.summary}>
            <Row label="Tạm tính" value={money(totals.subtotalMinor)} />
            <Row
              label="Phí giao"
              value={
                totals.freeDeliveryApplied ? 'Miễn phí (Plus)' : money(totals.deliveryFeeMinor)
              }
              highlight={totals.freeDeliveryApplied}
            />
            {totals.promoDiscountMinor > 0 ? (
              <Row label="Khuyến mãi" value={`−${money(totals.promoDiscountMinor)}`} />
            ) : null}
            <Row label="Tổng cộng" value={money(totals.totalMinor)} bold />
          </View>

          <Pressable
            style={styles.checkout}
            onPress={() =>
              router.push({
                pathname: '/food/checkout',
                params: {
                  restaurantId: lines[0]?.restaurantId ?? '',
                  zoneId: 'zone-q1-001',
                  cart: JSON.stringify(
                    lines.map((l) => ({
                      menuItemId: l.menuItemId,
                      quantity: l.quantity,
                    })),
                  ),
                  subtotal: String(subtotalMinor),
                  currencyCode: 'VND',
                  freeDelivery: totals.freeDeliveryApplied ? '1' : '0',
                },
              })
            }
          >
            <Text style={styles.checkoutLabel}>Thanh toán · {money(totals.totalMinor)}</Text>
          </Pressable>

          <Pressable style={styles.clearBtn} onPress={clear}>
            <Text style={styles.clearLabel}>Xoá giỏ hàng</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          bold && styles.bold,
          highlight && { color: GOXE.tealDark },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOXE.bgWarm },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GOXE.surface,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GOXE.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: GOXE.text,
  },
  headerSpacer: { width: 44 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 40,
  },
  emptyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  browseBtn: {
    marginTop: 8,
    backgroundColor: GOXE.teal,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  browseLabel: { color: '#FFFFFF', fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  restaurant: { fontSize: 16, fontWeight: '800', color: GOXE.text },
  line: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: GOXE.surface,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(8,30,34,0.05)' } as object,
      default: {},
    }),
  },
  lineName: { fontWeight: '700', color: GOXE.text, fontSize: 14 },
  addons: { marginTop: 2, color: GOXE.textMuted, fontSize: 12 },
  linePrice: { marginTop: 6, color: GOXE.tealDark, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOXE.tealSoftStrong,
    backgroundColor: GOXE.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 16, textAlign: 'center', fontWeight: '700', color: GOXE.text },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: GOXE.border,
    backgroundColor: GOXE.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: GOXE.text,
  },
  promoBtn: {
    backgroundColor: GOXE.tealDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  promoBtnLabel: { color: '#FFFFFF', fontWeight: '700' },
  summary: {
    backgroundColor: GOXE.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: GOXE.textSub, fontSize: 14 },
  summaryValue: { color: GOXE.text, fontSize: 14, fontWeight: '600' },
  bold: { fontWeight: '800', color: GOXE.text, fontSize: 15 },
  checkout: {
    marginTop: 4,
    backgroundColor: GOXE.tealDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  checkoutLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  clearBtn: { alignItems: 'center', paddingVertical: 8 },
  clearLabel: { color: GOXE.danger, fontWeight: '600' },
});
