import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OtpModal } from '@ridefood/ui';
import type { Ride } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { useApi, useAuth, useTheme } from '../../src/providers/AppProviders';
import {
  dropoffAddress,
  isActiveTrip,
  isIncomingRequest,
  nextTransitionAction,
  pickupAddress,
  transitionLabel,
} from '../../src/lib/rideTrip';

export default function DriverDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { api } = useApi();
  const { user, online, setOnline, market } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpRide, setOtpRide] = useState<Ride | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const driverId = user?.id ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rides.list();
      setRides(res.data);
    } finally {
      setLoading(false);
    }
  }, [api.rides]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await api.driver.setOnline(value, market?.center);
    } catch {
      // mock always succeeds
    }
  };

  const activeTrip = rides.find((r) => isActiveTrip(r, driverId));
  const incoming = rides.filter(isIncomingRequest);

  const runTransition = async (
    ride: Ride,
    action: 'accept' | 'arrive' | 'start' | 'complete',
    otp?: string,
  ) => {
    setActionLoading(true);
    setOtpError(null);
    try {
      await api.rides.transition(ride.id, { action, otp });
      setOtpVisible(false);
      setOtpRide(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Thao tác thất bại';
      if (action === 'start') setOtpError(message);
      else Alert.alert('Lỗi', message);
    } finally {
      setActionLoading(false);
    }
  };

  const onTripAction = (ride: Ride) => {
    const action = nextTransitionAction(ride);
    if (!action || action === 'cancel') return;
    if (action === 'start' && ride.otpRequired) {
      setOtpRide(ride);
      setOtpVisible(true);
      return;
    }
    void runTransition(ride, action);
  };

  const placeBid = async (ride: Ride) => {
    const raw = bidAmounts[ride.id] ?? String(ride.estimatedFareMinor);
    const amountMinor = Number(raw.replace(/\D/g, '')) || ride.estimatedFareMinor;
    setBusyId(ride.id);
    try {
      await api.bidding.create({ rideId: ride.id, amountMinor, message: 'Tôi sẵn sàng' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const acceptFixed = async (ride: Ride) => {
    setBusyId(ride.id);
    try {
      await api.rides.transition(ride.id, { action: 'accept' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>GOXE Driver</Text>
          <Text style={styles.hello}>Xin chào, {user?.firstName ?? 'Tài xế'}</Text>
        </View>
        <View style={styles.onlineRow}>
          <Text style={styles.onlineLabel}>{online ? 'Đang online' : 'Offline'}</Text>
          <Switch
            value={online}
            onValueChange={(v) => void toggleOnline(v)}
            trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
          />
        </View>
      </View>

      {activeTrip ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Chuyến đang chạy · {activeTrip.code}</Text>
          <Text style={styles.activeMeta}>
            {pickupAddress(activeTrip)} → {dropoffAddress(activeTrip)}
          </Text>
          <Text style={styles.activeMeta}>Trạng thái: {activeTrip.status}</Text>
          {nextTransitionAction(activeTrip) ? (
            <Pressable
              style={styles.activeAction}
              onPress={() => onTripAction(activeTrip)}
              disabled={actionLoading}
            >
              <Text style={styles.bidBtnLabel}>
                {transitionLabel(nextTransitionAction(activeTrip) ?? 'complete')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push({ pathname: '/ride/[id]', params: { id: activeTrip.id } })}>
            <Text style={styles.activeCta}>Mở bản đồ →</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Yêu cầu mới</Text>
      {!online ? (
        <Text style={styles.hint}>Bật online để nhận cuốc và đặt giá.</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={incoming}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Chưa có yêu cầu. Mock đã seed cuốc bidding.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.code}</Text>
              <Text style={styles.cardMeta}>
                {pickupAddress(item)} → {dropoffAddress(item)}
              </Text>
              <Text style={styles.fare}>
                Ước tính {formatMoney(item.estimatedFareMinor, { currency: item.currency, locale: 'vi' })}
                {item.pricingMode === 'bidding' ? ' · Đấu giá' : ''}
              </Text>
              {item.pricingMode === 'bidding' ? (
                <View style={styles.bidRow}>
                  <TextInput
                    style={styles.bidInput}
                    keyboardType="number-pad"
                    placeholder="Giá đề xuất (VND)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={bidAmounts[item.id] ?? String(item.estimatedFareMinor)}
                    onChangeText={(t) => setBidAmounts((prev) => ({ ...prev, [item.id]: t }))}
                  />
                  <Pressable
                    style={styles.bidBtn}
                    disabled={busyId === item.id}
                    onPress={() => void placeBid(item)}
                  >
                    <Text style={styles.bidBtnLabel}>{busyId === item.id ? '…' : 'Đặt giá'}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.acceptBtn}
                  disabled={busyId === item.id}
                  onPress={() => void acceptFixed(item)}
                >
                  <Text style={styles.bidBtnLabel}>Nhận cuốc</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.push({ pathname: '/ride/[id]', params: { id: item.id } })}>
                <Text style={styles.detailLink}>Chi tiết</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <OtpModal
        visible={otpVisible}
        mode="input"
        title="Nhập OTP bắt đầu chuyến"
        subtitle="Khách đọc mã 4 số (demo: 4821)"
        confirmLabel="Xác nhận"
        loading={actionLoading}
        error={otpError}
        onClose={() => {
          setOtpVisible(false);
          setOtpRide(null);
          setOtpError(null);
        }}
        onConfirm={(code) => {
          if (otpRide) void runTransition(otpRide, 'start', code);
        }}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    brand: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
    hello: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    onlineRow: { alignItems: 'flex-end', gap: 4 },
    onlineLabel: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
    activeCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    activeTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
    activeMeta: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13 },
    activeAction: {
      marginTop: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    activeCta: { color: '#fff', marginTop: 10, fontWeight: '700' },
    section: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
    hint: { color: theme.colors.textMuted, marginBottom: 12 },
    empty: { color: theme.colors.textMuted, marginTop: 24, textAlign: 'center' },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontWeight: '700', color: theme.colors.text, fontSize: 16 },
    cardMeta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
    fare: { marginTop: 8, fontWeight: '600', color: theme.colors.primary },
    bidRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    bidInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceMuted,
    },
    bidBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    acceptBtn: {
      marginTop: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    bidBtnLabel: { color: '#fff', fontWeight: '700' },
    detailLink: { marginTop: 10, color: theme.colors.primary, fontWeight: '600' },
  });
}