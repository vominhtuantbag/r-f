import type {
  CityPricingTemplate,
  Currency,
  DeliveryZone,
  FareBid,
  FoodOrder,
  FoodOrderStatus,
  GamificationProfile,
  GeoPoint,
  ISODateTime,
  Market,
  MarketKpis,
  MenuItem,
  MergedOrderBatch,
  MoneyMinor,
  PaymentMethod,
  PricingMode,
  PromoCode,
  Restaurant,
  Ride,
  RideStatus,
  RideStop,
  SubscriptionPlan,
  SupportTicket,
  SupportTicketMessage,
  User,
  UserSubscription,
  UUID,
  VehicleType,
  WalletTransaction,
  WithdrawalRequest,
  DriverDocument,
} from './domain';

/** Generic API envelope */
export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  status?: number;
}

export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export interface LoginRequest {
  phone: string;
  password?: string;
  otp?: string;
  role: 'rider' | 'driver' | 'partner';
}

export interface RegisterRequest {
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'rider' | 'driver' | 'partner';
  marketId?: UUID;
  locale?: string;
}

export interface GoogleAuthRequest {
  role: 'rider' | 'driver' | 'partner';
  marketId?: UUID;
  /** Optional Google ID token when using native Google Sign-In SDK. */
  idToken?: string;
  locale?: string;
}

export interface FareEstimateRequest {
  marketId: UUID;
  vehicleTypeId: UUID;
  stops: RideStop[];
  isParcel?: boolean;
  isIntercity?: boolean;
  scheduledAt?: ISODateTime | null;
  promoCode?: string;
}

export interface FareEstimateResponse {
  estimatedFareMinor: MoneyMinor;
  minBidMinor: MoneyMinor | null;
  maxBidMinor: MoneyMinor | null;
  currency: Currency;
  pricingMode: PricingMode;
  distanceMeters: number;
  durationSeconds: number;
  etaMinutes: number;
  otpRequired: boolean;
  promoDiscountMinor: MoneyMinor;
  subscriptionDiscountMinor: MoneyMinor;
}

export interface CreateRideRequest {
  marketId: UUID;
  vehicleTypeId: UUID;
  stops: RideStop[];
  paymentMethod: PaymentMethod;
  pricingMode?: PricingMode;
  offeredFareMinor?: MoneyMinor;
  isParcel?: boolean;
  isIntercity?: boolean;
  scheduledAt?: ISODateTime | null;
  promoCode?: string;
  notes?: string;
}

export interface CounterBidRequest {
  amountMinor: MoneyMinor;
  message?: string;
}

export interface PlaceFoodOrderRequest {
  restaurantId: UUID;
  zoneId: UUID;
  items: Array<{
    menuItemId: UUID;
    quantity: number;
    variantId?: UUID | null;
    addonIds?: UUID[];
    notes?: string;
  }>;
  deliveryAddress: string;
  deliveryPoint: GeoPoint;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  notes?: string;
}

export interface ApplyPromoRequest {
  code: string;
  appliesContext: 'ride' | 'food';
  marketId: UUID;
  zoneId?: UUID;
  subtotalMinor: MoneyMinor;
}

export interface ApplyPromoResponse {
  valid: boolean;
  promo: PromoCode | null;
  discountMinor: MoneyMinor;
  message: string | null;
}

export interface SubscribeRequest {
  planId: UUID;
  paymentMethod: PaymentMethod;
}

export interface WithdrawalCreateRequest {
  amountMinor: MoneyMinor;
  payoutMethod: string;
  payoutDetails: Record<string, string>;
}

export interface TripTransitionRequest {
  action: 'accept' | 'arrive' | 'start' | 'complete' | 'cancel';
  otp?: string;
  lat?: number;
  lng?: number;
}

export interface BidCreateRequest {
  rideId: UUID;
  amountMinor: MoneyMinor;
  message?: string;
}

export interface SupportTicketCreateRequest {
  subject: string;
  body: string;
  relatedType?: SupportTicket['relatedType'];
  relatedId?: UUID;
  priority?: SupportTicket['priority'];
}

export interface SupportMessageRequest {
  body: string;
  attachments?: string[];
}

export interface MenuAvailabilityUpdate {
  menuItemId?: UUID;
  addonId?: UUID;
  isAvailable: boolean;
}

export interface PartnerOrderStatusUpdate {
  status: Extract<FoodOrderStatus, 'accepted' | 'preparing' | 'ready' | 'cancelled'>;
}

/** Endpoint response aliases */
export type MeResponse = ApiSuccess<User>;
export type MarketsResponse = ApiSuccess<Market[]>;
export type VehicleTypesResponse = ApiSuccess<VehicleType[]>;
export type ZonesResponse = ApiSuccess<DeliveryZone[]>;
export type RideResponse = ApiSuccess<Ride>;
export type RidesResponse = Paginated<Ride>;
export type BidsResponse = ApiSuccess<FareBid[]>;
export type BidResponse = ApiSuccess<FareBid>;
export type RestaurantsResponse = Paginated<Restaurant>;
export type RestaurantDetailResponse = ApiSuccess<
  Restaurant & { menu: MenuItem[]; categories: Array<{ id: UUID; name: string }> }
>;
export type FoodOrderResponse = ApiSuccess<FoodOrder>;
export type FoodOrdersResponse = Paginated<FoodOrder>;
export type MergedBatchResponse = ApiSuccess<MergedOrderBatch>;
export type PromoValidateResponse = ApiSuccess<ApplyPromoResponse>;
export type PlansResponse = ApiSuccess<SubscriptionPlan[]>;
export type SubscriptionResponse = ApiSuccess<UserSubscription>;
export type GamificationResponse = ApiSuccess<GamificationProfile>;
export type WalletResponse = ApiSuccess<{
  balanceMinor: MoneyMinor;
  currency: Currency;
  transactions: WalletTransaction[];
}>;
export type WithdrawalResponse = ApiSuccess<WithdrawalRequest>;
export type SupportTicketResponse = ApiSuccess<SupportTicket>;
export type SupportTicketsResponse = Paginated<SupportTicket>;
export type SupportMessageResponse = ApiSuccess<SupportTicketMessage>;
export type MarketKpisResponse = ApiSuccess<MarketKpis>;
export type CityTemplatesResponse = ApiSuccess<CityPricingTemplate[]>;
export type DocumentsResponse = ApiSuccess<DriverDocument[]>;

/** Supabase RPC request shapes */
export interface CreateRideRpcArgs {
  p_market_id: UUID;
  p_vehicle_type_id: UUID;
  p_stops: RideStop[];
  p_payment_method: PaymentMethod;
  p_is_parcel?: boolean;
  p_is_intercity?: boolean;
  p_scheduled_at?: ISODateTime | null;
  p_offered_fare_minor?: MoneyMinor | null;
  p_notes?: string | null;
}

export interface TransitionRideRpcArgs {
  p_ride_id: UUID;
  p_action: 'accept' | 'arrive' | 'start' | 'complete' | 'cancel';
  p_otp?: string | null;
  p_lat?: number | null;
  p_lng?: number | null;
}

export interface ApplyCityTemplateRpcArgs {
  p_template_code: string;
  p_market_name: string;
  p_slug: string;
  p_country_code: string;
  p_lng: number;
  p_lat: number;
  p_timezone?: string;
}

/** Realtime / websocket event contracts */
export type RealtimeChannel =
  | `private-user.${string}`
  | `private-ride.${string}`
  | `private-order.${string}`
  | `private-driver.${string}`
  | `private-support.${string}`
  | `private-market.${string}`;

export type RealtimeEventName =
  | 'ride.status_changed'
  | 'ride.location_updated'
  | 'ride.bid_received'
  | 'ride.bid_updated'
  | 'ride.otp_revealed'
  | 'order.status_changed'
  | 'order.merged'
  | 'driver.request'
  | 'support.message'
  | 'support.ticket_updated'
  | 'wallet.updated'
  | 'gamification.updated';

export interface RealtimeEnvelope<T = unknown> {
  event: RealtimeEventName;
  channel: RealtimeChannel;
  data: T;
  occurredAt: ISODateTime;
}

export interface RideStatusChangedPayload {
  rideId: UUID;
  status: RideStatus;
  ride: Ride;
}

export interface RideLocationUpdatedPayload {
  rideId: UUID;
  driverId: UUID;
  point: GeoPoint;
  heading: number | null;
  speedMps: number | null;
}

export interface BidRealtimePayload {
  rideId: UUID;
  bid: FareBid;
}

export interface OrderStatusChangedPayload {
  orderId: UUID;
  status: FoodOrderStatus;
  order: FoodOrder;
  mergedBatchId: UUID | null;
}

export interface SupportMessagePayload {
  ticketId: UUID;
  message: SupportTicketMessage;
}

export interface DriverRequestPayload {
  rideId: UUID;
  ride: Ride;
  expiresAt: ISODateTime;
}
