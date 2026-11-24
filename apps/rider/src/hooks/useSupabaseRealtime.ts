import { useEffect, useRef } from 'react';
import {
  subscribeDriverLocation,
  subscribeFoodOrder,
  subscribeMergedBatch,
  subscribeRideBids,
  subscribeRideDriverLocation,
  subscribeRideStatus,
  subscribeSupportChat,
  type RowSubscription,
} from '@ridefood/supabase';
import type {
  BidRealtimePayload,
  OrderStatusChangedPayload,
  RideLocationUpdatedPayload,
  RideStatus,
  SupportMessagePayload,
} from '@ridefood/types';

function useSubscription(
  enabled: boolean,
  factory: () => RowSubscription,
  deps: unknown[],
) {
  const unsubRef = useRef<RowSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const sub = factory();
    unsubRef.current = sub;
    return () => {
      void sub.unsubscribe();
      unsubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Ride status postgres_changes — cleans up on unmount / rideId change. */
export function useRideStatusRealtime(
  rideId: string | null | undefined,
  onChange: (payload: { rideId: string; status: RideStatus }) => void,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useSubscription(
    Boolean(rideId),
    () =>
      subscribeRideStatus(rideId!, (p) =>
        cb.current({ rideId: p.rideId, status: p.status }),
      ),
    [rideId],
  );
}

/** Fare bids for a ride. */
export function useRideBidsRealtime(
  rideId: string | null | undefined,
  onBid: (payload: BidRealtimePayload) => void,
) {
  const cb = useRef(onBid);
  cb.current = onBid;
  useSubscription(
    Boolean(rideId),
    () => subscribeRideBids(rideId!, (p) => cb.current(p)),
    [rideId],
  );
}

/** Food order status (+ merged batch id). */
export function useFoodOrderRealtime(
  orderId: string | null | undefined,
  onChange: (payload: OrderStatusChangedPayload) => void,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useSubscription(
    Boolean(orderId),
    () => subscribeFoodOrder(orderId!, (p) => cb.current(p)),
    [orderId],
  );
}

/** Merged batch status for partner/driver dashboards. */
export function useMergedBatchRealtime(
  batchId: string | null | undefined,
  onChange: (batchId: string, status: string) => void,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useSubscription(
    Boolean(batchId),
    () =>
      subscribeMergedBatch(batchId!, (row) => cb.current(row.id, row.status)),
    [batchId],
  );
}

/** Support chat INSERT stream. */
export function useSupportChatRealtime(
  ticketId: string | null | undefined,
  onMessage: (payload: SupportMessagePayload) => void,
) {
  const cb = useRef(onMessage);
  cb.current = onMessage;
  useSubscription(
    Boolean(ticketId),
    () => subscribeSupportChat(ticketId!, (p) => cb.current(p)),
    [ticketId],
  );
}

/** Driver GPS updates. */
export function useDriverLocationRealtime(
  driverId: string | null | undefined,
  onLocation: (payload: {
    driverId: string;
    point: { lat: number; lng: number } | null;
    heading: number | null;
    speedMps: number | null;
  }) => void,
) {
  const cb = useRef(onLocation);
  cb.current = onLocation;
  useSubscription(
    Boolean(driverId),
    () =>
      subscribeDriverLocation(driverId!, (p) =>
        cb.current({
          driverId: p.driverId,
          point: p.point,
          heading: p.heading,
          speedMps: p.speedMps,
        }),
      ),
    [driverId],
  );
}

/** Ride-scoped driver GPS (maps to RideLocationUpdatedPayload). */
export function useRideDriverLocationRealtime(
  rideId: string | null | undefined,
  driverId: string | null | undefined,
  onLocation: (payload: RideLocationUpdatedPayload) => void,
) {
  const cb = useRef(onLocation);
  cb.current = onLocation;
  useSubscription(
    Boolean(rideId && driverId),
    () =>
      subscribeRideDriverLocation(rideId!, driverId!, (p) => cb.current(p)),
    [rideId, driverId],
  );
}
