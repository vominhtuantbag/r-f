import type {
  Currency,
  MoneyMinor,
  PricingMode,
  PromoCode,
  SubscriptionPlan,
  UserSubscription,
} from '@ridefood/types';
import { majorToMinor, minorToMajor } from './currency';

export interface FixedFareInput {
  baseFareMinor: MoneyMinor;
  perKmMinor: MoneyMinor;
  perMinuteMinor: MoneyMinor;
  minFareMinor: MoneyMinor;
  distanceKm: number;
  durationMinutes: number;
}

export function calculateFixedFare(input: FixedFareInput): MoneyMinor {
  const distancePart = Math.round(input.perKmMinor * input.distanceKm);
  const timePart = Math.round(input.perMinuteMinor * input.durationMinutes);
  const raw = input.baseFareMinor + distancePart + timePart;
  return Math.max(raw, input.minFareMinor);
}

export interface BidBounds {
  minBidMinor: MoneyMinor;
  maxBidMinor: MoneyMinor;
  suggestedMinor: MoneyMinor;
}

/** InDrive-style bounds around an estimated fare. */
export function calculateBidBounds(
  estimatedFareMinor: MoneyMinor,
  options?: { minRatio?: number; maxRatio?: number },
): BidBounds {
  const minRatio = options?.minRatio ?? 0.7;
  const maxRatio = options?.maxRatio ?? 1.4;
  const minBidMinor = Math.max(1, Math.round(estimatedFareMinor * minRatio));
  const maxBidMinor = Math.round(estimatedFareMinor * maxRatio);
  return {
    minBidMinor,
    maxBidMinor,
    suggestedMinor: estimatedFareMinor,
  };
}

export function clampBid(
  amountMinor: MoneyMinor,
  bounds: BidBounds,
): { valid: boolean; amountMinor: MoneyMinor; reason?: string } {
  if (amountMinor < bounds.minBidMinor) {
    return {
      valid: false,
      amountMinor: bounds.minBidMinor,
      reason: 'Bid below market minimum',
    };
  }
  if (amountMinor > bounds.maxBidMinor) {
    return {
      valid: false,
      amountMinor: bounds.maxBidMinor,
      reason: 'Bid above market maximum',
    };
  }
  return { valid: true, amountMinor };
}

export function resolvePricingMode(
  marketMode: PricingMode,
  requested?: PricingMode,
): PricingMode {
  if (marketMode === 'fixed') return 'fixed';
  if (marketMode === 'bidding') return requested ?? 'bidding';
  return requested ?? marketMode;
}

export function calculatePromoDiscount(
  subtotalMinor: MoneyMinor,
  promo: Pick<
    PromoCode,
    'discountType' | 'discountValue' | 'maxDiscountMinor' | 'minOrderMinor'
  >,
): MoneyMinor {
  if (promo.minOrderMinor != null && subtotalMinor < promo.minOrderMinor) {
    return 0;
  }

  let discount: MoneyMinor;
  if (promo.discountType === 'percentage') {
    discount = Math.round((subtotalMinor * promo.discountValue) / 100);
  } else {
    discount = promo.discountValue;
  }

  if (promo.maxDiscountMinor != null) {
    discount = Math.min(discount, promo.maxDiscountMinor);
  }

  return Math.min(discount, subtotalMinor);
}

export function calculateSubscriptionRideDiscount(
  fareMinor: MoneyMinor,
  plan: Pick<SubscriptionPlan, 'rideDiscountPercent'>,
): MoneyMinor {
  if (plan.rideDiscountPercent <= 0) return 0;
  return Math.round((fareMinor * plan.rideDiscountPercent) / 100);
}

export function isSubscriptionFreeDeliveryEligible(
  subscription: UserSubscription | null | undefined,
): boolean {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.plan.freeFoodDelivery) return false;
  const cap = subscription.plan.freeDeliveryMaxOrdersPerMonth;
  if (cap == null) return true;
  return subscription.freeDeliveryUsedThisPeriod < cap;
}

export interface CheckoutTotalsInput {
  subtotalMinor: MoneyMinor;
  deliveryFeeMinor: MoneyMinor;
  promo?: PromoCode | null;
  subscription?: UserSubscription | null;
  currency: Currency;
  context: 'ride' | 'food';
}

export interface CheckoutTotals {
  subtotalMinor: MoneyMinor;
  deliveryFeeMinor: MoneyMinor;
  promoDiscountMinor: MoneyMinor;
  subscriptionDiscountMinor: MoneyMinor;
  freeDeliveryApplied: boolean;
  totalMinor: MoneyMinor;
  currency: Currency;
}

export function calculateCheckoutTotals(input: CheckoutTotalsInput): CheckoutTotals {
  let deliveryFeeMinor = input.deliveryFeeMinor;
  let subscriptionDiscountMinor = 0;
  let freeDeliveryApplied = false;

  if (input.context === 'food' && isSubscriptionFreeDeliveryEligible(input.subscription)) {
    deliveryFeeMinor = 0;
    freeDeliveryApplied = true;
  }

  if (input.context === 'ride' && input.subscription?.status === 'active') {
    subscriptionDiscountMinor = calculateSubscriptionRideDiscount(
      input.subtotalMinor,
      input.subscription.plan,
    );
  }

  const promoApplies =
    input.promo &&
    (input.promo.appliesTo === 'both' ||
      (input.context === 'ride' && input.promo.appliesTo === 'rides') ||
      (input.context === 'food' && input.promo.appliesTo === 'food'));

  const promoDiscountMinor =
    promoApplies && input.promo
      ? calculatePromoDiscount(input.subtotalMinor, input.promo)
      : 0;

  const totalMinor = Math.max(
    0,
    input.subtotalMinor + deliveryFeeMinor - promoDiscountMinor - subscriptionDiscountMinor,
  );

  return {
    subtotalMinor: input.subtotalMinor,
    deliveryFeeMinor,
    promoDiscountMinor,
    subscriptionDiscountMinor,
    freeDeliveryApplied,
    totalMinor,
    currency: input.currency,
  };
}

/** Helper for displaying a fare range during bidding (e.g. "$8 – $14"). */
export function formatBidRange(
  bounds: BidBounds,
  format: (minor: MoneyMinor) => string,
): string {
  return `${format(bounds.minBidMinor)} – ${format(bounds.maxBidMinor)}`;
}

export function percentOf(amountMinor: MoneyMinor, percent: number, currency: Currency): MoneyMinor {
  const major = minorToMajor(amountMinor, currency);
  return majorToMinor((major * percent) / 100, currency);
}
