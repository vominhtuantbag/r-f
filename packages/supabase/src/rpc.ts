import type {
  ApplyCityTemplateRpcArgs,
  CreateRideRpcArgs,
  TransitionRideRpcArgs,
} from '@ridefood/types';
import type { RideFoodSupabase } from './client';
import { getSupabase } from './client';
import type { Json } from './database.types';

function clientOr(c?: RideFoodSupabase) {
  return c ?? getSupabase();
}

export async function rpcEstimateFare(
  args: {
    marketId: string;
    vehicleTypeId: string;
    distanceMeters: number;
    durationSeconds: number;
  },
  client?: RideFoodSupabase,
) {
  const { data, error } = await clientOr(client).rpc('estimate_ride_fare', {
    p_market_id: args.marketId,
    p_vehicle_type_id: args.vehicleTypeId,
    p_distance_meters: args.distanceMeters,
    p_duration_seconds: args.durationSeconds,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function rpcCreateRide(args: CreateRideRpcArgs, client?: RideFoodSupabase) {
  const p_stops = args.p_stops.map((s) => ({
    type: s.type,
    address: s.address,
    point: { lat: s.point.lat, lng: s.point.lng },
    contactName: s.contactName ?? null,
    contactPhone: s.contactPhone ?? null,
  })) as unknown as Json;

  const { data, error } = await clientOr(client).rpc('create_ride', {
    p_market_id: args.p_market_id,
    p_vehicle_type_id: args.p_vehicle_type_id,
    p_stops,
    p_payment_method: args.p_payment_method,
    p_is_parcel: args.p_is_parcel,
    p_is_intercity: args.p_is_intercity,
    p_scheduled_at: args.p_scheduled_at,
    p_offered_fare_minor: args.p_offered_fare_minor,
    p_notes: args.p_notes,
  });
  if (error) throw error;
  return data;
}

export async function rpcTransitionRide(args: TransitionRideRpcArgs, client?: RideFoodSupabase) {
  const { data, error } = await clientOr(client).rpc('transition_ride', args);
  if (error) throw error;
  return data;
}

export async function rpcPlaceBid(
  args: { rideId: string; amountMinor: number; message?: string },
  client?: RideFoodSupabase,
) {
  const { data, error } = await clientOr(client).rpc('place_fare_bid', {
    p_ride_id: args.rideId,
    p_amount_minor: args.amountMinor,
    p_message: args.message ?? null,
  });
  if (error) throw error;
  return data;
}

export async function rpcAcceptBid(
  args: { rideId: string; bidId: string },
  client?: RideFoodSupabase,
) {
  const { data, error } = await clientOr(client).rpc('accept_fare_bid', {
    p_ride_id: args.rideId,
    p_bid_id: args.bidId,
  });
  if (error) throw error;
  return data;
}

export async function rpcValidatePromo(
  args: {
    code: string;
    context: 'ride' | 'food';
    marketId: string;
    zoneId?: string;
    subtotalMinor?: number;
  },
  client?: RideFoodSupabase,
) {
  const { data, error } = await clientOr(client).rpc('validate_promo', {
    p_code: args.code,
    p_context: args.context,
    p_market_id: args.marketId,
    p_zone_id: args.zoneId ?? null,
    p_subtotal_minor: args.subtotalMinor ?? 0,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function rpcMergeBatch(orderId: string, client?: RideFoodSupabase) {
  const { data, error } = await clientOr(client).rpc('create_or_attach_merge_batch', {
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}

export async function rpcApplyCityTemplate(
  args: ApplyCityTemplateRpcArgs,
  client?: RideFoodSupabase,
) {
  const { data, error } = await clientOr(client).rpc('apply_city_pricing_template', args);
  if (error) throw error;
  return data as string;
}

export async function rpcTrackRide(token: string, client?: RideFoodSupabase) {
  const { data, error } = await clientOr(client).rpc('track_ride_by_token', { p_token: token });
  if (error) throw error;
  return data;
}

export async function rpcTrackOrder(token: string, client?: RideFoodSupabase) {
  const { data, error } = await clientOr(client).rpc('track_order_by_token', { p_token: token });
  if (error) throw error;
  return data;
}

export async function fetchMarketKpis(marketId: string, client?: RideFoodSupabase) {
  const { data, error } = await clientOr(client)
    .from('v_market_kpis')
    .select('*')
    .eq('market_id', marketId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
