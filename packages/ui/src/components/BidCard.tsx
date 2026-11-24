import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FareBid, MoneyMinor } from '@ridefood/types';
import { defaultTheme } from '@ridefood/config';
import { formatMoney } from '@ridefood/utils';

export interface BidCardProps {
  bid: FareBid;
  formatAmount?: (amountMinor: MoneyMinor) => string;
  onAccept?: (bid: FareBid) => void;
  onReject?: (bid: FareBid) => void;
  onCounter?: (bid: FareBid) => void;
  disabled?: boolean;
}

export function BidCard({
  bid,
  formatAmount,
  onAccept,
  onReject,
  onCounter,
  disabled = false,
}: BidCardProps) {
  const money =
    formatAmount?.(bid.amountMinor) ??
    formatMoney(bid.amountMinor, { currency: bid.currency });

  const driverName = bid.driver
    ? `${bid.driver.firstName} ${bid.driver.lastName}`.trim()
    : 'Driver';

  return (
    <View style={[styles.card, defaultTheme.shadow(2), disabled && styles.disabled]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{driverName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{driverName}</Text>
          <Text style={styles.sub}>
            {bid.driver?.vehicleLabel ?? 'Vehicle'} · ★{(bid.driver?.ratingAvg ?? 0).toFixed(1)} ·{' '}
            {bid.driver?.etaMinutes ?? '—'} min
          </Text>
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.price}>{money}</Text>
          <Text style={styles.status}>{bid.status}</Text>
        </View>
      </View>

      {bid.message ? <Text style={styles.message}>{bid.message}</Text> : null}

      {bid.status === 'pending' || bid.status === 'countered' ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.rejectBtn}
            disabled={disabled}
            onPress={() => onReject?.(bid)}
          >
            <Text style={styles.rejectLabel}>Reject</Text>
          </Pressable>
          <Pressable
            style={styles.counterBtn}
            disabled={disabled}
            onPress={() => onCounter?.(bid)}
          >
            <Text style={styles.counterLabel}>Counter</Text>
          </Pressable>
          <Pressable
            style={styles.acceptBtn}
            disabled={disabled}
            onPress={() => onAccept?.(bid)}
          >
            <Text style={styles.acceptLabel}>Accept</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: defaultTheme.colors.bidHighlight,
    borderRadius: defaultTheme.radii.lg,
    padding: defaultTheme.spacing.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    marginBottom: defaultTheme.spacing.sm,
  },
  disabled: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'center', gap: defaultTheme.spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: defaultTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: defaultTheme.colors.textInverse,
    fontWeight: defaultTheme.typography.weights.bold,
  },
  meta: { flex: 1 },
  name: {
    fontWeight: defaultTheme.typography.weights.semibold,
    color: defaultTheme.colors.text,
    fontSize: defaultTheme.typography.sizes.md,
  },
  sub: { color: defaultTheme.colors.textMuted, fontSize: defaultTheme.typography.sizes.sm },
  priceWrap: { alignItems: 'flex-end' },
  price: {
    fontSize: defaultTheme.typography.sizes.lg,
    fontWeight: defaultTheme.typography.weights.bold,
    color: defaultTheme.colors.primary,
  },
  status: {
    fontSize: defaultTheme.typography.sizes.xs,
    color: defaultTheme.colors.textMuted,
    textTransform: 'capitalize',
  },
  message: {
    marginTop: defaultTheme.spacing.sm,
    color: defaultTheme.colors.text,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: defaultTheme.spacing.sm,
    marginTop: defaultTheme.spacing.md,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: defaultTheme.radii.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    alignItems: 'center',
  },
  rejectLabel: { color: defaultTheme.colors.textMuted, fontWeight: '600' },
  counterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: defaultTheme.radii.md,
    backgroundColor: defaultTheme.colors.surface,
    borderWidth: 1,
    borderColor: defaultTheme.colors.primary,
    alignItems: 'center',
  },
  counterLabel: { color: defaultTheme.colors.primary, fontWeight: '600' },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: defaultTheme.radii.md,
    backgroundColor: defaultTheme.colors.primary,
    alignItems: 'center',
  },
  acceptLabel: { color: defaultTheme.colors.textInverse, fontWeight: '700' },
});
