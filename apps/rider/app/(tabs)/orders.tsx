import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FoodOrder, Ride, RideStatus } from '@ridefood/types';
import { formatMoney } from '@ridefood/utils';
import { MergedOrderBadge } from '@ridefood/ui';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FilterPills } from '../../src/components/ui/FilterPills';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { useApi, useAuth } from '../../src/providers/AppProviders';
import { GOXE } from '../../src/theme/goxe';

type HistoryMode = 'rides' | 'food';
type RideFilter = 'all' | 'active' | 'done';

const ACTIVE_STATUSES: RideStatus[] = [
  'searching',
  'bidding',
  'accepted',
  'driver_arrived',
  'in_progress',
];
const DONE_STATUSES: RideStatus[] = ['completed', 'cancelled'];

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    searching: 'Đang tìm',
    bidding: 'Đang đấu giá',
    accepted: 'Đã nhận',
    driver_arrived: 'Tài xế đã đến',
    in_progress: 'Đang chạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã huỷ',
    pending: 'Chờ quán',
    preparing: 'Đang làm',
    ready: 'Sẵn sàng',
    picked_up: 'Đã lấy',
    delivered: 'Đã giao',
  };
  return map[status] ?? status;
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { api } = useApi();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<HistoryMode>('rides');
  const [rideFilter, setRideFilter] = useState<RideFilter>('all');
  const [rides, setRides] = useState<Ride[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRides([]);
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const [rideRes, orderRes] = await Promise.all([
        api.rides.list({ page: 1 }),
        api.food.orders({ page: 1 }),
      ]);
      setRides(rideRes.data);
      setOrders(orderRes.data);
    } catch {
      setRides([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [api.food, api.rides, isAuthenticated]);

  const filteredRides = useMemo(() => {
    if (rideFilter === 'active') {
      return rides.filter((r) => ACTIVE_STATUSES.includes(r.status));
    }
    if (rideFilter === 'done') {
      return rides.filter((r) => DONE_STATUSES.includes(r.status));
    }
    return rides;
  }, [rideFilter, rides]);

  const showRideEmpty = filteredRides.length === 0;
  const showFoodEmpty = orders.length === 0;
  const refreshControl = (
    <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={GOXE.teal} />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.screenTitle}>Lịch sử</Text>

      <View style={styles.pad}>
        <SegmentedControl
          options={[
            { key: 'rides', label: 'Chuyến xe' },
            { key: 'food', label: 'Food & Giao' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      {mode === 'rides' ? (
        <>
          <View style={styles.pad}>
            <FilterPills
              options={[
                { key: 'all', label: 'Tất cả' },
                { key: 'active', label: 'Đang chạy' },
                { key: 'done', label: 'Xong' },
              ]}
              value={rideFilter}
              onChange={setRideFilter}
            />
          </View>

          {showRideEmpty ? (
            <FlatList
              data={[]}
              keyExtractor={() => 'empty'}
              renderItem={null}
              refreshControl={refreshControl}
              contentContainerStyle={styles.emptyList}
              ListEmptyComponent={
                <EmptyState icon="bicycle-outline" title="Chưa có chuyến xe" />
              }
            />
          ) : (
            <FlatList
              data={filteredRides}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={refreshControl}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: '/ride/[id]/tracking',
                      params: { id: item.id },
                    })
                  }
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.code}>{item.code}</Text>
                    <Text style={styles.badge}>{statusLabel(item.status)}</Text>
                  </View>
                  <Text style={styles.route} numberOfLines={2}>
                    {item.stops[0]?.address ?? 'Điểm đón'} →{' '}
                    {item.stops[item.stops.length - 1]?.address ?? 'Điểm đến'}
                  </Text>
                  <Text style={styles.fare}>
                    {formatMoney(item.finalFareMinor ?? item.estimatedFareMinor, {
                      currency: item.currency,
                      locale: 'vi-VN',
                    })}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </>
      ) : showFoodEmpty ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'empty-food'}
          renderItem={null}
          refreshControl={refreshControl}
          contentContainerStyle={styles.emptyList}
          ListEmptyComponent={
            <EmptyState icon="receipt-outline" title="Chưa có đơn food/giao hàng" />
          }
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.code}>{item.code}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MergedOrderBadge count={item.mergedBatchId ? 2 : 1} compact />
                  <Text style={styles.badge}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.route} numberOfLines={2}>
                {item.deliveryAddress}
              </Text>
              <Text style={styles.fare}>
                {formatMoney(item.totalMinor, {
                  currency: item.currency,
                  locale: 'vi-VN',
                })}
                {item.subscriptionFreeDelivery ? ' · Free ship' : ''}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOXE.bg },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: GOXE.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pad: { paddingHorizontal: 16, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1 },
  card: {
    backgroundColor: GOXE.surface,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(8,30,34,0.06)' } as object,
      default: {},
    }),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  code: { fontWeight: '800', color: GOXE.text, fontSize: 15 },
  badge: {
    color: GOXE.tealDark,
    fontWeight: '700',
    fontSize: 12,
  },
  route: { marginTop: 6, color: GOXE.textSub, fontSize: 13, lineHeight: 18 },
  fare: { marginTop: 8, fontWeight: '700', color: GOXE.tealDark, fontSize: 14 },
});
