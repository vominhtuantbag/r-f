import type { FoodOrder, GeoPoint, OrderMergeRules } from '@ridefood/types';

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Client-side mirror of SQL `find_mergeable_orders` rules (preview only). */
export function isMergeEligible(
  anchor: Pick<FoodOrder, 'restaurantId' | 'marketId' | 'status' | 'deliveryPoint' | 'createdAt'>,
  candidate: Pick<
    FoodOrder,
    'id' | 'restaurantId' | 'marketId' | 'status' | 'deliveryPoint' | 'createdAt' | 'mergedBatchId'
  >,
  rules: OrderMergeRules,
  nowMs = Date.now(),
): boolean {
  if (!rules.enabled) return false;
  if (rules.sameRestaurantOnly && candidate.restaurantId !== anchor.restaurantId) return false;
  if (candidate.marketId !== anchor.marketId) return false;
  if (candidate.mergedBatchId) return false;
  if (!['ready', 'accepted', 'preparing'].includes(candidate.status)) return false;

  const ageSec = (nowMs - new Date(candidate.createdAt).getTime()) / 1000;
  if (ageSec > rules.maxWaitSeconds) return false;

  if (rules.maxDropoffDistanceMeters > 0) {
    const d = haversineMeters(anchor.deliveryPoint, candidate.deliveryPoint);
    if (d > rules.maxDropoffDistanceMeters) return false;
  }

  return true;
}

export function pickMergeCandidates(
  anchor: FoodOrder,
  pool: FoodOrder[],
  rules: OrderMergeRules,
): FoodOrder[] {
  return pool
    .filter((o) => o.id !== anchor.id && isMergeEligible(anchor, o, rules))
    .slice(0, Math.max(rules.maxOrders - 1, 0));
}
