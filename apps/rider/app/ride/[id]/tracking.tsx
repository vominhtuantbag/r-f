import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { GeoPoint, Ride } from '@ridefood/types';
import { MapViewWrapper, OtpModal } from '@ridefood/ui';
import { formatMoney, openTel, shareTrackingLink } from '@ridefood/utils';
import { useApi, useTheme } from '../../../src/providers/AppProviders';

export default function RideTrackingScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, realtime } = useApi();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverPoint, setDriverPoint] = useState<GeoPoint | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.rides.get(id);
        if (!alive) return;
        setRide(res.data);
        if (res.data.otpRequired && res.data.otpCode) setOtpOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load ride');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.rides, id]);

  useEffect(() => {
    if (!id) return;
    const subs = [
      realtime.subscribe(`private-ride.${id}`, 'ride.status_changed', (env) => {
        const payload = env.data as { ride: Ride };
        setRide(payload.ride);
        if (payload.ride.otpRequired && payload.ride.otpCode) setOtpOpen(true);
      }),
      realtime.subscribe(`private-ride.${id}`, 'ride.location_updated', (env) => {
        const payload = env.data as { point: GeoPoint };
        setDriverPoint(payload.point);
      }),
      realtime.subscribe(`private-ride.${id}`, 'ride.otp_revealed', (env) => {
        const payload = env.data as { ride: Ride };
        setRide(payload.ride);
        setOtpOpen(true);
      }),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, [id, realtime]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Ride not found'}</Text>
      </View>
    );
  }

  const pickup = ride.stops.find((s) => s.type === 'pickup')?.point ?? {
    lat: 0,
    lng: 0,
  };
  const dropoff = ride.stops.find((s) => s.type === 'dropoff')?.point ?? pickup;
  const center = driverPoint ?? pickup;

  return (
    <View style={styles.root}>
      <MapViewWrapper
        style={styles.map}
        center={center}
        markers={[
          { id: 'pickup', coordinate: pickup, title: 'Pickup', color: theme.colors.primary },
          { id: 'dropoff', coordinate: dropoff, title: 'Drop-off', color: theme.colors.danger },
          ...(driverPoint
            ? [{ id: 'driver', coordinate: driverPoint, title: 'Driver', color: theme.colors.info }]
            : []),
        ]}
      />

      <View style={[styles.sheet, theme.shadow(6)]}>
        <Text style={styles.status}>{ride.status.replaceAll('_', ' ')}</Text>
        <Text style={styles.code}>{ride.code}</Text>
        <Text style={styles.meta}>
          {formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, {
            currency: ride.currency,
          })}
        </Text>

        {ride.otpRequired && ride.otpCode ? (
          <Pressable style={styles.otpBtn} onPress={() => setOtpOpen(true)}>
            <Text style={styles.otpBtnLabel}>Show trip OTP</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => void shareTrackingLink({ kind: 'ride', token: ride.trackingToken })}
          >
            <Text style={styles.actionLabel}>Share link</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => void openTel('+10000000000')}>
            <Text style={styles.actionLabel}>Call driver</Text>
          </Pressable>
        </View>
      </View>

      <OtpModal
        visible={otpOpen && Boolean(ride.otpCode)}
        mode="display"
        code={ride.otpCode}
        subtitle="Share this 4-digit code with your driver to start the trip."
        onClose={() => setOtpOpen(false)}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    map: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    status: {
      textTransform: 'capitalize',
      color: theme.colors.primary,
      fontWeight: '700',
    },
    code: {
      fontSize: theme.typography.sizes.xxl,
      fontWeight: '700',
      color: theme.colors.text,
    },
    meta: { color: theme.colors.textMuted },
    otpBtn: {
      backgroundColor: theme.colors.bidHighlight,
      borderRadius: theme.radii.md,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.otpAccent,
    },
    otpBtnLabel: { color: theme.colors.otpAccent, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: theme.spacing.sm },
    action: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    actionLabel: { color: theme.colors.textInverse, fontWeight: '700' },
    error: { color: theme.colors.danger },
  });
}
