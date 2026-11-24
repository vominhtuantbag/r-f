/** Domain models shared across Rider / Driver / Partner / Web. */

export type UUID = string;
export type ISODateTime = string;
export type MoneyMinor = number; // store in minor units (cents/fils)

export type UserRole = 'rider' | 'driver' | 'partner' | 'admin' | 'support_agent';
export type PricingMode = 'fixed' | 'bidding';
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'wallet'
  | 'stripe'
  | 'paypal'
  | 'razorpay'
  | 'myfatoorah';

export type RideStatus =
  | 'draft'
  | 'searching'
  | 'bidding'
  | 'accepted'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type FoodOrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
export type SupportTicketStatus = 'open' | 'pending' | 'escalated' | 'resolved' | 'closed';
export type SubscriptionInterval = 'monthly' | 'yearly';
export type PromoDiscountType = 'percentage' | 'fixed';
export type PromoAppliesTo = 'rides' | 'food' | 'both';
export type DocumentVerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Currency {
  code: string; // ISO 4217
  symbol: string;
  decimalPlaces: number;
  name: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  northEast: GeoPoint;
  southWest: GeoPoint;
}

export interface User {
  id: UUID;
  role: UserRole;
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  locale: string;
  marketId: UUID | null;
  walletBalanceMinor: MoneyMinor;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Market {
  id: UUID;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  currency: Currency;
  pricingMode: PricingMode;
  otpTripStartEnabled: boolean;
  biddingEnabled: boolean;
  surgeEnabled: boolean;
  isActive: boolean;
  bounds: GeoBounds | null;
  center: GeoPoint;
}

export interface DeliveryZone {
  id: UUID;
  marketId: UUID;
  name: string;
  currency: Currency;
  deliveryFeeMinor: MoneyMinor;
  freeDeliveryMinOrderMinor: MoneyMinor | null;
  minOrderMinor: MoneyMinor;
  polygon: GeoPoint[];
  isActive: boolean;
}

export interface VehicleType {
  id: UUID;
  marketId: UUID;
  name: string;
  slug: string;
  capacity: number;
  iconUrl: string | null;
  baseFareMinor: MoneyMinor;
  perKmMinor: MoneyMinor;
  perMinuteMinor: MoneyMinor;
  minFareMinor: MoneyMinor;
  supportsParcel: boolean;
  supportsIntercity: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface RideStop {
  type: 'pickup' | 'dropoff' | 'waypoint';
  address: string;
  point: GeoPoint;
  contactName?: string;
  contactPhone?: string;
}

export interface Ride {
  id: UUID;
  code: string;
  riderId: UUID;
  driverId: UUID | null;
  marketId: UUID;
  vehicleTypeId: UUID;
  status: RideStatus;
  pricingMode: PricingMode;
  isParcel: boolean;
  isIntercity: boolean;
  scheduledAt: ISODateTime | null;
  stops: RideStop[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  estimatedFareMinor: MoneyMinor;
  finalFareMinor: MoneyMinor | null;
  currency: Currency;
  paymentMethod: PaymentMethod;
  promoCodeId: UUID | null;
  subscriptionDiscountMinor: MoneyMinor;
  otpCode: string | null; // 4-digit; null when OTP disabled for market
  otpRequired: boolean;
  trackingToken: string;
  rating: number | null;
  notes: string | null;
  acceptedAt: ISODateTime | null;
  arrivedAt: ISODateTime | null;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FareBid {
  id: UUID;
  rideId: UUID;
  driverId: UUID;
  amountMinor: MoneyMinor;
  currency: Currency;
  status: BidStatus;
  counterAmountMinor: MoneyMinor | null;
  message: string | null;
  expiresAt: ISODateTime;
  driver?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> & {
    ratingAvg: number;
    vehicleLabel: string;
    etaMinutes: number;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MenuAddon {
  id: UUID;
  name: string;
  priceMinor: MoneyMinor;
  isAvailable: boolean;
}

export interface MenuItemVariant {
  id: UUID;
  name: string;
  priceDeltaMinor: MoneyMinor;
  isAvailable: boolean;
}

export interface MenuItem {
  id: UUID;
  restaurantId: UUID;
  categoryId: UUID;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceMinor: MoneyMinor;
  isAvailable: boolean;
  variants: MenuItemVariant[];
  addons: MenuAddon[];
}

export interface Restaurant {
  id: UUID;
  marketId: UUID;
  zoneId: UUID;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  etaMinutes: number;
  isOpen: boolean;
  currency: Currency;
  address: string;
  point: GeoPoint;
}

export interface FoodOrderItem {
  id: UUID;
  menuItemId: UUID;
  name: string;
  quantity: number;
  unitPriceMinor: MoneyMinor;
  variantId: UUID | null;
  variantName: string | null;
  addonIds: UUID[];
  addonNames: string[];
  notes: string | null;
  lineTotalMinor: MoneyMinor;
}

export interface FoodOrder {
  id: UUID;
  code: string;
  riderId: UUID;
  restaurantId: UUID;
  driverId: UUID | null;
  marketId: UUID;
  zoneId: UUID;
  status: FoodOrderStatus;
  items: FoodOrderItem[];
  subtotalMinor: MoneyMinor;
  deliveryFeeMinor: MoneyMinor;
  discountMinor: MoneyMinor;
  totalMinor: MoneyMinor;
  currency: Currency;
  paymentMethod: PaymentMethod;
  promoCodeId: UUID | null;
  subscriptionFreeDelivery: boolean;
  mergedBatchId: UUID | null;
  deliveryAddress: string;
  deliveryPoint: GeoPoint;
  notes: string | null;
  trackingToken: string;
  estimatedDeliveryAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MergedOrderBatch {
  id: UUID;
  restaurantId: UUID;
  driverId: UUID | null;
  marketId: UUID;
  zoneId: UUID;
  orderIds: UUID[];
  status: 'open' | 'assigned' | 'picked_up' | 'completed' | 'cancelled';
  maxOrders: number;
  maxDistanceMeters: number;
  pickupPoint: GeoPoint;
  currency: Currency;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PromoCode {
  id: UUID;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number; // percent (0-100) or fixed minor units
  appliesTo: PromoAppliesTo;
  marketIds: UUID[];
  zoneIds: UUID[];
  maxTotalUses: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  minOrderMinor: MoneyMinor | null;
  maxDiscountMinor: MoneyMinor | null;
  startsAt: ISODateTime;
  expiresAt: ISODateTime;
  isActive: boolean;
}

export interface SubscriptionPlan {
  id: UUID;
  name: string;
  interval: SubscriptionInterval;
  priceMinor: MoneyMinor;
  currency: Currency;
  rideDiscountPercent: number;
  freeFoodDelivery: boolean;
  freeDeliveryMaxOrdersPerMonth: number | null;
  marketIds: UUID[];
  isActive: boolean;
  features: string[];
}

export interface UserSubscription {
  id: UUID;
  userId: UUID;
  planId: UUID;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  currentPeriodStart: ISODateTime;
  currentPeriodEnd: ISODateTime;
  cancelAtPeriodEnd: boolean;
  freeDeliveryUsedThisPeriod: number;
}

export interface GamificationBadge {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  xpReward: number;
  criteriaKey: string;
  criteriaThreshold: number;
}

export interface GamificationLevel {
  level: number;
  title: string;
  xpRequired: number;
}

export interface GamificationProfile {
  driverId: UUID;
  xp: number;
  level: number;
  levelTitle: string;
  xpToNextLevel: number;
  xpProgressPercent: number;
  badges: Array<GamificationBadge & { unlockedAt: ISODateTime | null }>;
}

export interface SupportTicketMessage {
  id: UUID;
  ticketId: UUID;
  senderId: UUID;
  senderRole: UserRole;
  body: string;
  attachments: string[];
  createdAt: ISODateTime;
}

export interface SupportTicket {
  id: UUID;
  code: string;
  userId: UUID;
  assigneeId: UUID | null;
  subject: string;
  status: SupportTicketStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  relatedType: 'ride' | 'food_order' | 'wallet' | 'other' | null;
  relatedId: UUID | null;
  refundStatus: 'none' | 'requested' | 'approved' | 'rejected' | 'processed';
  refundAmountMinor: MoneyMinor | null;
  messages: SupportTicketMessage[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Deterministic ops KPIs from `v_market_kpis` (no AI). */
export interface MarketKpis {
  marketId: UUID;
  marketName: string;
  currencyCode: string;
  ridesCompletedToday: number;
  ordersDeliveredToday: number;
  driversOnline: number;
  restaurantsOpen: number;
  rideFulfillmentRate7d: number;
  rideRevenueMinorToday: MoneyMinor;
  foodRevenueMinorToday: MoneyMinor;
}

/** Rule-based city onboarding template (replaces AI Setup Wizard). */
export interface CityPricingTemplate {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  defaultCurrencyCode: string;
  defaultPricingMode: PricingMode;
  otpTripStartEnabled: boolean;
  vehiclePresets: Array<Record<string, unknown>>;
  zoneFeePresets: Array<Record<string, unknown>>;
  mergeRulePresets: Record<string, unknown>;
  surgeRules: Record<string, unknown>;
  isActive: boolean;
}

export interface OrderMergeRules {
  id: UUID;
  marketId: UUID;
  enabled: boolean;
  maxOrders: number;
  maxPickupDistanceMeters: number;
  maxDropoffDistanceMeters: number;
  maxWaitSeconds: number;
  sameRestaurantOnly: boolean;
}

export interface DriverDocument {
  id: UUID;
  driverId: UUID;
  type: 'license' | 'id_card' | 'vehicle_registration' | 'insurance' | 'profile_photo';
  fileUrl: string;
  status: DocumentVerificationStatus;
  rejectionReason: string | null;
  expiresAt: ISODateTime | null;
  reviewedAt: ISODateTime | null;
}

export interface WalletTransaction {
  id: UUID;
  userId: UUID;
  type: 'credit' | 'debit';
  amountMinor: MoneyMinor;
  currency: Currency;
  reason: string;
  referenceType: string | null;
  referenceId: UUID | null;
  createdAt: ISODateTime;
}

export interface WithdrawalRequest {
  id: UUID;
  driverId: UUID;
  amountMinor: MoneyMinor;
  currency: Currency;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  payoutMethod: string;
  payoutDetails: Record<string, string>;
  createdAt: ISODateTime;
  processedAt: ISODateTime | null;
}
