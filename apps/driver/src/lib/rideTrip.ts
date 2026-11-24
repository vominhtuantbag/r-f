import type { Ride, TripTransitionRequest } from '@ridefood/types';

export function pickupAddress(ride: Ride): string {
  return ride.stops.find((s) => s.type === 'pickup')?.address ?? 'Điểm đón';
}

export function dropoffAddress(ride: Ride): string {
  return ride.stops.find((s) => s.type === 'dropoff')?.address ?? 'Điểm đến';
}

export function nextTransitionAction(ride: Ride): TripTransitionRequest['action'] | null {
  switch (ride.status) {
    case 'searching':
    case 'bidding':
      return 'accept';
    case 'accepted':
      return 'arrive';
    case 'driver_arrived':
      return 'start';
    case 'in_progress':
      return 'complete';
    default:
      return null;
  }
}

export function transitionLabel(action: TripTransitionRequest['action']): string {
  const labels: Record<TripTransitionRequest['action'], string> = {
    accept: 'Nhận chuyến',
    arrive: 'Đã đến điểm đón',
    start: 'Bắt đầu chuyến',
    complete: 'Hoàn thành',
    cancel: 'Hủy',
  };
  return labels[action];
}

export function isActiveTrip(ride: Ride, driverId: string): boolean {
  const active = new Set(['accepted', 'driver_arrived', 'in_progress']);
  return ride.driverId === driverId && active.has(ride.status);
}

export function isIncomingRequest(ride: Ride): boolean {
  return (ride.status === 'bidding' || ride.status === 'searching') && ride.driverId == null;
}