import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  BidRealtimePayload,
  FareBid,
  FoodOrderStatus,
  OrderStatusChangedPayload,
  RideLocationUpdatedPayload,
  RideStatus,
  SupportMessagePayload,
  SupportTicketMessage,
} from '@ridefood/types';
import type { Database } from './database.types';
import type { RideFoodSupabase } from './client';
import { getSupabase, isSupabaseMockMode } from './client';

export type TableEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RowSubscription<T = unknown> {
  channel: RealtimeChannel | null;
  unsubscribe: () => Promise<void>;
}

type RideRow = Database['public']['Tables']['rides']['Row'];
type BidRow = Database['public']['Tables']['fare_bids']['Row'];
type OrderRow = Database['public']['Tables']['food_orders']['Row'];
type BatchRow = Database['public']['Tables']['merged_order_batches']['Row'];
type DriverRow = Database['public']['Tables']['drivers']['Row'];
type SupportMsgRow = Database['public']['Tables']['support_messages']['Row'];

function noopSubscription(): RowSubscription {
  return {
    channel: null,
    unsubscribe: async () => undefined,
  };
}

/**
 * Subscribe to Postgres changes via Supabase Realtime.
 * In mock mode returns a no-op subscription (callers use polling / local state).
 */
export function subscribeTable<T extends Record<string, unknown>>(options: {
  client?: RideFoodSupabase;
  channelName: string;
  table: keyof Database['public']['Tables'] | string;
  event?: TableEvent;
  filter?: string;
  onPayload: (payload: {
    eventType: TableEvent;
    new: T;
    old: Partial<T>;
  }) => void;
}): RowSubscription<T> {
  if (isSupabaseMockMode()) return noopSubscription();

  const client = options.client ?? getSupabase();
  const channel = client
    .channel(options.channelName)
    .on(
      'postgres_changes',
      {
        event: options.event ?? '*',
        schema: 'public',
        table: String(options.table),
        filter: options.filter,
      },
      (payload) => {
        options.onPayload({
          eventType: payload.eventType as TableEvent,
          new: (payload.new ?? {}) as T,
          old: (payload.old ?? {}) as Partial<T>,
        });
      },
    )
    .subscribe();

  return {
    channel,
    unsubscribe: async () => {
      await client.removeChannel(channel);
    },
  };
}

/** Ride status changes for a single trip. */
export function subscribeRideStatus(
  rideId: string,
  onChange: (payload: {
    rideId: string;
    status: RideStatus;
    row: RideRow;
  }) => void,
): RowSubscription {
  return subscribeTable<RideRow & Record<string, unknown>>({
    channelName: `ride:${rideId}`,
    table: 'rides',
    filter: `id=eq.${rideId}`,
    onPayload: ({ new: row }) => {
      if (!row?.id) return;
      onChange({
        rideId: row.id,
        status: row.status as RideStatus,
        row,
      });
    },
  });
}

/** @deprecated Prefer `subscribeRideStatus`. */
export function subscribeRide(
  rideId: string,
  onChange: (row: Record<string, unknown>) => void,
) {
  return subscribeRideStatus(rideId, ({ row }) => onChange(row as Record<string, unknown>));
}

/** Fare bid INSERT/UPDATE for a ride (bidding markets). */
export function subscribeRideBids(
  rideId: string,
  onBid: (payload: BidRealtimePayload & { eventType: TableEvent }) => void,
): RowSubscription {
  return subscribeTable<BidRow & Record<string, unknown>>({
    channelName: `ride-bids:${rideId}`,
    table: 'fare_bids',
    filter: `ride_id=eq.${rideId}`,
    onPayload: ({ eventType, new: row }) => {
      if (!row?.id) return;
      const bid = mapBidRow(row);
      onBid({
        eventType,
        rideId,
        bid,
      });
    },
  });
}

/** Food order status + merged-batch id updates. */
export function subscribeFoodOrder(
  orderId: string,
  onChange: (payload: OrderStatusChangedPayload & { row: OrderRow }) => void,
): RowSubscription {
  return subscribeTable<OrderRow & Record<string, unknown>>({
    channelName: `order:${orderId}`,
    table: 'food_orders',
    filter: `id=eq.${orderId}`,
    onPayload: ({ new: row }) => {
      if (!row?.id) return;
      onChange({
        orderId: row.id,
        status: row.status as FoodOrderStatus,
        mergedBatchId: row.merged_batch_id,
        order: {
          id: row.id,
          code: row.code,
          riderId: row.rider_id,
          restaurantId: row.restaurant_id,
          driverId: row.driver_id,
          marketId: '',
          zoneId: '',
          status: row.status as FoodOrderStatus,
          items: [],
          subtotalMinor: 0,
          deliveryFeeMinor: 0,
          discountMinor: 0,
          totalMinor: 0,
          currency: { code: 'VND', symbol: '₫', decimalPlaces: 0, name: 'Vietnamese Dong' },
          paymentMethod: 'cash',
          promoCodeId: null,
          subscriptionFreeDelivery: false,
          mergedBatchId: row.merged_batch_id,
          deliveryAddress: '',
          deliveryPoint: { lat: 0, lng: 0 },
          notes: null,
          trackingToken: row.tracking_token,
          estimatedDeliveryAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: row.updated_at ?? new Date().toISOString(),
        },
        row,
      });
    },
  });
}

/** Merged batch status (partner / driver). */
export function subscribeMergedBatch(
  batchId: string,
  onChange: (row: BatchRow) => void,
): RowSubscription {
  return subscribeTable<BatchRow & Record<string, unknown>>({
    channelName: `batch:${batchId}`,
    table: 'merged_order_batches',
    filter: `id=eq.${batchId}`,
    onPayload: ({ new: row }) => {
      if (row?.id) onChange(row);
    },
  });
}

/** Live support chat messages (INSERT only). */
export function subscribeSupportChat(
  ticketId: string,
  onMessage: (payload: SupportMessagePayload) => void,
): RowSubscription {
  return subscribeTable<SupportMsgRow & Record<string, unknown>>({
    channelName: `support:${ticketId}`,
    table: 'support_messages',
    filter: `ticket_id=eq.${ticketId}`,
    event: 'INSERT',
    onPayload: ({ new: row }) => {
      if (!row?.id) return;
      const message: SupportTicketMessage = {
        id: row.id,
        ticketId: row.ticket_id,
        senderId: row.sender_id,
        senderRole: 'rider',
        body: row.body,
        attachments: [],
        createdAt: row.created_at,
      };
      onMessage({ ticketId, message });
    },
  });
}

/** @deprecated Prefer `subscribeSupportChat`. */
export function subscribeSupportTicket(
  ticketId: string,
  onMessage: (row: Record<string, unknown>) => void,
) {
  return subscribeSupportChat(ticketId, ({ message }) =>
    onMessage(message as unknown as Record<string, unknown>),
  );
}

/**
 * Driver GPS updates. Prefer filtering by `id=eq.{driverId}`.
 * Payload maps to `RideLocationUpdatedPayload` when `rideId` is provided.
 */
export function subscribeDriverLocation(
  driverId: string,
  onLocation: (payload: {
    driverId: string;
    point: { lat: number; lng: number } | null;
    heading: number | null;
    speedMps: number | null;
    at: string | null;
    row: DriverRow;
  }) => void,
  options?: { rideId?: string },
): RowSubscription {
  return subscribeTable<DriverRow & Record<string, unknown>>({
    channelName: `driver-gps:${driverId}`,
    table: 'drivers',
    filter: `id=eq.${driverId}`,
    event: 'UPDATE',
    onPayload: ({ new: row }) => {
      if (!row?.id) return;
      const point = parseGeoPoint(row.last_location);
      onLocation({
        driverId: row.id,
        point,
        heading: row.heading,
        speedMps: row.speed_mps,
        at: row.last_location_at,
        row,
      });
      void options;
    },
  });
}

/** Convenience: GPS stream shaped as ride location envelope. */
export function subscribeRideDriverLocation(
  rideId: string,
  driverId: string,
  onLocation: (payload: RideLocationUpdatedPayload) => void,
): RowSubscription {
  return subscribeDriverLocation(driverId, (loc) => {
    if (!loc.point) return;
    onLocation({
      rideId,
      driverId,
      point: loc.point,
      heading: loc.heading,
      speedMps: loc.speedMps,
    });
  });
}

function mapBidRow(row: BidRow): FareBid {
  const now = new Date().toISOString();
  return {
    id: row.id,
    rideId: row.ride_id,
    driverId: row.driver_id,
    amountMinor: row.amount_minor,
    currency: {
      code: row.currency_code || 'VND',
      symbol: '₫',
      decimalPlaces: 0,
      name: 'Vietnamese Dong',
    },
    status: row.status as FareBid['status'],
    counterAmountMinor: row.counter_amount_minor,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? now,
  };
}

/** Best-effort PostGIS / GeoJSON / {lat,lng} parser. */
function parseGeoPoint(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
      return { lat: obj.lat, lng: obj.lng };
    }
    if (obj.type === 'Point' && Array.isArray(obj.coordinates)) {
      const [lng, lat] = obj.coordinates as number[];
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    }
    if (typeof obj.coordinates === 'object' && obj.coordinates !== null) {
      const c = obj.coordinates as { lat?: number; lng?: number };
      if (typeof c.lat === 'number' && typeof c.lng === 'number') return c as { lat: number; lng: number };
    }
  }
  if (typeof raw === 'string') {
    const m = raw.match(/(-?\d+\.?\d*)\s+[,\s]\s*(-?\d+\.?\d*)/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      // WKT POINT(lng lat)
      if (raw.toUpperCase().includes('POINT')) return { lng: a, lat: b };
      return { lat: a, lng: b };
    }
  }
  return null;
}
