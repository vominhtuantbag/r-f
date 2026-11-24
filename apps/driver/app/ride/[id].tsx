import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Ride } from '@ridefood/types';
import { MapViewWrapper, OtpModal } from '@ridefood/ui';
import { formatMoney } from '@ridefood/utils';
import { useApi, useTheme } from '../../src/providers/AppProviders';

const FLOW: Array<{
  status: Ride['status'];
  action: 'accept' | 'arrive' | 'start' | 'complete';
  label: string;
}> = [
  { status: 'searching', action: 'accept', label: 'Nhận chuyến' },
  { status: 'bidding', action: 'accept', label: 'Nhận chuyến' },
  { status: 'accepted', action: 'arrive', label: 'Đã đến điểm đón' },
  { status: 'driver_arrived', action: 'start', label: 'Bắt đầu (nhập OTP)' },
  { status: 'in_progress', action: 'complete', label: 'Hoàn thành chuyến' },
];

export default function DriverRideScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useApi();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.rides.get(id);
      setRide(res.data);
    } finally {
      setLoading(false);
    }
  }, [api.rides, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const next = FLOW.find((f) => f.status === ride?.status);

  const runTransition = async (
    action: 'accept' | 'arrive' | 'start' | 'complete',
    otp?: string,
  ) => {
    if (!ride) return;
    setBusy(true);
    setOtpError(null);
    try {
      const res = await api.rides.transition(ride.id, { action, otp });
      setRide(res.data);
      setOtpOpen(false);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Lỗi xác thực');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !ride) {
    return (
      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" />
        ) : (
          <Text style={styles.error}>Không tìm thấy chuyến</Text>
        )}
      </View>
    );
  }

  const pickup = ride.stops.find((s) => s.type === 'pickup')?.point ?? { lat: 10.77, lng: 106.7 };

  return (
    <View style={styles.root}>
      <MapViewWrapper
        style={styles.map}
        center={pickup}
        markers={ride.stops.map((s, i) => ({
          id: `${s.type}-${i}`,
          coordinate: s.point,
          title: s.type,
          description: s.address,
        }))}
      />
      <View style={styles.sheet}>
        <Text style={styles.code}>{ride.code}</Text>
        <Text style={styles.status}>Trạng thái: {ride.status}</Text>
        <Text style={styles.fare}>
          {formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, {
            currency: ride.currency,
            locale: 'vi',
          })}
        </Text>
        {ride.otpRequired ? (
          <Text style={styles.otpHint}>
            OTP chuyến (rider thấy): {ride.otpCode ?? '****'} — tài xế nhập khi Start
          </Text>
        ) : null}

        {next ? (
          <Pressable
            style={[styles.cta, busy && styles.disabled]}
            disabled={busy}
            onPress={() => {
              if (next.action === 'start' && ride.otpRequired) {
                setOtpOpen(true);
                return;
              }
              void runTransition(next.action);
            }}
          >
            <Text style={styles.ctaLabel}>{busy ? 'Đang xử lý…' : next.label}</Text>
          </Pressable>
        ) : (
          <Text style={styles.done}>
            {ride.status === 'completed' ? 'Đã hoàn thành' : 'Không còn bước tiếp'}
          </Text>
        )}
      </View>

      <OtpModal
        visible={otpOpen}
        mode="input"
        title="Nhập mã OTP 4 số"
        subtitle="Khách sẽ đọc mã trên app Rider"
        confirmLabel="Start trip"
        error={otpError}
        loading={busy}
        onClose={() => setOtpOpen(false)}
        onConfirm={(code) => void runTransition('start', code)}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    map: { flex: 1 },
    sheet: {
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 6,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    code: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
    status: { color: theme.colors.textMuted, textTransform: 'capitalize' },
    fare: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },
    otpHint: { color: theme.colors.info, marginTop: 4 },
    cta: {
      marginTop: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaLabel: { color: '#fff', fontWeight: '700' },
    disabled: { opacity: 0.6 },
    done: { marginTop: 12, fontWeight: '600', color: theme.colors.success },
    error: { color: theme.colors.danger },
  });
}
