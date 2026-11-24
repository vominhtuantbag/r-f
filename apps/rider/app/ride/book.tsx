import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  FareBid,
  FareEstimateResponse,
  PaymentMethod,
  PricingMode,
  VehicleType,
} from '@ridefood/types';
import { BidCard } from '@ridefood/ui';
import {
  calculateBidBounds,
  formatMoney,
  resolvePricingMode,
} from '@ridefood/utils';
import { useApi, useAuth, useTheme } from '../../src/providers/AppProviders';

export default function BookRideScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    destination?: string;
    parcel?: string;
    intercity?: string;
    scheduled?: string;
    marketId?: string;
  }>();
  const { api, realtime } = useApi();
  const { market } = useAuth();

  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [pickup, setPickup] = useState('Current location');
  const [dropoff, setDropoff] = useState(params.destination ?? '');
  const [isParcel, setIsParcel] = useState(params.parcel === '1');
  const [isIntercity, setIsIntercity] = useState(params.intercity === '1');
  const [scheduled, setScheduled] = useState(params.scheduled === '1');
  const [estimate, setEstimate] = useState<FareEstimateResponse | null>(null);
  const [offeredFare, setOfferedFare] = useState('');
  const [promo, setPromo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [bids, setBids] = useState<FareBid[]>([]);
  const [rideId, setRideId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketId = market?.id ?? params.marketId ?? '';
  const styles = useMemo(() => createStyles(theme), [theme]);

  const pricingMode: PricingMode = resolvePricingMode(
    market?.pricingMode ?? 'fixed',
    market?.biddingEnabled ? 'bidding' : 'fixed',
  );

  useEffect(() => {
    if (!marketId) return;
    void api.markets.vehicles(marketId).then((res) => {
      setVehicles(res.data);
      setVehicleId(res.data[0]?.id ?? null);
    });
  }, [api.markets, marketId]);

  useEffect(() => {
    if (!rideId || pricingMode !== 'bidding') return;
    const sub = realtime.subscribe(`private-ride.${rideId}`, 'ride.bid_received', (env) => {
      const bid = (env.data as { bid: FareBid }).bid;
      setBids((prev) => {
        const without = prev.filter((b) => b.id !== bid.id);
        return [bid, ...without];
      });
    });
    return () => sub.unsubscribe();
  }, [pricingMode, realtime, rideId]);

  const runEstimate = async () => {
    if (!marketId || !vehicleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.rides.estimate({
        marketId,
        vehicleTypeId: vehicleId,
        stops: [
          { type: 'pickup', address: pickup, point: market?.center ?? { lat: 0, lng: 0 } },
          {
            type: 'dropoff',
            address: dropoff || 'Destination',
            point: {
              lat: (market?.center.lat ?? 0) + 0.02,
              lng: (market?.center.lng ?? 0) + 0.02,
            },
          },
        ],
        isParcel,
        isIntercity,
        promoCode: promo || undefined,
        scheduledAt: scheduled ? new Date(Date.now() + 3600_000).toISOString() : null,
      });
      setEstimate(res.data);
      setOfferedFare(String(res.data.estimatedFareMinor / 100));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setLoading(false);
    }
  };

  const createRide = async () => {
    if (!marketId || !vehicleId || !estimate) return;
    setLoading(true);
    setError(null);
    try {
      const offeredFareMinor =
        pricingMode === 'bidding'
          ? Math.round(Number(offeredFare) * (estimate.currency.decimalPlaces === 3 ? 1000 : 100))
          : undefined;

      const res = await api.rides.create({
        marketId,
        vehicleTypeId: vehicleId,
        stops: [
          { type: 'pickup', address: pickup, point: market?.center ?? { lat: 0, lng: 0 } },
          {
            type: 'dropoff',
            address: dropoff || 'Destination',
            point: {
              lat: (market?.center.lat ?? 0) + 0.02,
              lng: (market?.center.lng ?? 0) + 0.02,
            },
          },
        ],
        paymentMethod,
        pricingMode,
        offeredFareMinor,
        isParcel,
        isIntercity,
        scheduledAt: scheduled ? new Date(Date.now() + 3600_000).toISOString() : null,
        promoCode: promo || undefined,
      });

      setRideId(res.data.id);
      if (pricingMode === 'fixed' || res.data.status === 'accepted') {
        router.replace({
          pathname: '/ride/[id]/tracking',
          params: { id: res.data.id },
        });
      } else {
        const bidRes = await api.bidding.listForRide(res.data.id);
        setBids(bidRes.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const bidBounds = estimate
    ? calculateBidBounds(estimate.estimatedFareMinor)
    : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Route</Text>
      <TextInput
        style={styles.input}
        value={pickup}
        onChangeText={setPickup}
        placeholder="Pickup"
        placeholderTextColor={theme.colors.textMuted}
      />
      <TextInput
        style={styles.input}
        value={dropoff}
        onChangeText={setDropoff}
        placeholder="Drop-off"
        placeholderTextColor={theme.colors.textMuted}
      />

      <View style={styles.toggles}>
        <ToggleRow label="Parcel" value={isParcel} onChange={setIsParcel} theme={theme} />
        <ToggleRow label="Inter-city" value={isIntercity} onChange={setIsIntercity} theme={theme} />
        <ToggleRow label="Schedule" value={scheduled} onChange={setScheduled} theme={theme} />
      </View>

      <Text style={styles.section}>Vehicle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicles}>
        {vehicles.map((v) => (
          <Pressable
            key={v.id}
            style={[styles.vehicle, vehicleId === v.id && styles.vehicleActive]}
            onPress={() => setVehicleId(v.id)}
          >
            <Text style={styles.vehicleName}>{v.name}</Text>
            <Text style={styles.vehicleMeta}>{v.capacity} seats</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section}>Promo</Text>
      <TextInput
        style={styles.input}
        value={promo}
        onChangeText={setPromo}
        autoCapitalize="characters"
        placeholder="PROMO code"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.section}>Payment</Text>
      <View style={styles.payRow}>
        {(['wallet', 'cash', 'stripe', 'paypal', 'razorpay', 'myfatoorah'] as PaymentMethod[]).map(
          (m) => (
            <Pressable
              key={m}
              style={[styles.payChip, paymentMethod === m && styles.payChipActive]}
              onPress={() => setPaymentMethod(m)}
            >
              <Text
                style={[
                  styles.payChipLabel,
                  paymentMethod === m && styles.payChipLabelActive,
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      <Pressable style={styles.secondary} onPress={() => void runEstimate()} disabled={loading}>
        <Text style={styles.secondaryLabel}>Get estimate</Text>
      </Pressable>

      {estimate ? (
        <View style={[styles.estimate, theme.shadow(2)]}>
          <Text style={styles.estimateTitle}>
            {formatMoney(estimate.estimatedFareMinor, { currency: estimate.currency })}
          </Text>
          <Text style={styles.estimateMeta}>
            {estimate.etaMinutes} min · {Math.round(estimate.distanceMeters / 1000)} km · mode{' '}
            {estimate.pricingMode}
            {estimate.otpRequired ? ' · OTP required' : ''}
          </Text>
          {estimate.promoDiscountMinor > 0 ? (
            <Text style={styles.perk}>
              Promo −{formatMoney(estimate.promoDiscountMinor, { currency: estimate.currency })}
            </Text>
          ) : null}
          {pricingMode === 'bidding' && bidBounds ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={styles.section}>Your offer</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={offeredFare}
                onChangeText={setOfferedFare}
              />
              <Text style={styles.estimateMeta}>
                Range {formatMoney(bidBounds.minBidMinor, { currency: estimate.currency })} –{' '}
                {formatMoney(bidBounds.maxBidMinor, { currency: estimate.currency })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.primary}
        onPress={() => void createRide()}
        disabled={loading || !estimate}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.primaryLabel}>
            {pricingMode === 'bidding' ? 'Request bids' : 'Confirm booking'}
          </Text>
        )}
      </Pressable>

      {rideId && pricingMode === 'bidding' ? (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.section}>Driver offers</Text>
          <FlatList
            data={bids}
            scrollEnabled={false}
            keyExtractor={(b) => b.id}
            ListEmptyComponent={<Text style={styles.estimateMeta}>Waiting for bids…</Text>}
            renderItem={({ item }) => (
              <BidCard
                bid={item}
                onAccept={async (bid) => {
                  const res = await api.bidding.accept(rideId, bid.id);
                  router.replace({
                    pathname: '/ride/[id]/tracking',
                    params: { id: res.data.id },
                  });
                }}
                onReject={async (bid) => {
                  await api.bidding.reject(rideId, bid.id);
                  setBids((prev) => prev.filter((b) => b.id !== bid.id));
                }}
                onCounter={async (bid) => {
                  const amount = Math.round(bid.amountMinor * 0.9);
                  await api.bidding.counter(rideId, bid.id, { amountMinor: amount });
                }}
              />
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primary }}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.md, paddingBottom: 48, gap: theme.spacing.sm },
    section: {
      marginTop: theme.spacing.sm,
      fontWeight: '700',
      color: theme.colors.text,
      fontSize: theme.typography.sizes.md,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    toggles: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    vehicles: { gap: theme.spacing.sm },
    vehicle: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginRight: theme.spacing.sm,
      minWidth: 110,
    },
    vehicleActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.bidHighlight,
    },
    vehicleName: { fontWeight: '700', color: theme.colors.text },
    vehicleMeta: { color: theme.colors.textMuted, marginTop: 4 },
    payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    payChip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    payChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    payChipLabel: { color: theme.colors.text, textTransform: 'capitalize', fontSize: 12 },
    payChipLabelActive: { color: theme.colors.textInverse, fontWeight: '700' },
    secondary: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    secondaryLabel: { color: theme.colors.primary, fontWeight: '700' },
    primary: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryLabel: { color: theme.colors.textInverse, fontWeight: '700' },
    estimate: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    estimateTitle: {
      fontSize: theme.typography.sizes.xxl,
      fontWeight: '700',
      color: theme.colors.text,
    },
    estimateMeta: { color: theme.colors.textMuted, marginTop: 4 },
    perk: { color: theme.colors.success, marginTop: 6, fontWeight: '600' },
    error: { color: theme.colors.danger },
  });
}
