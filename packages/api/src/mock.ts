import { getEnv } from '@ridefood/config';
import {
  calculateBidBounds,
  calculateCheckoutTotals,
  calculateFixedFare,
  calculatePromoDiscount,
} from '@ridefood/utils';
import type {
  AuthSession,
  AuthTokens,
  CreateRideRequest,
  FareEstimateResponse,
  FoodOrder,
  LoginRequest,
  PlaceFoodOrderRequest,
  Ride,
  SupportTicketMessage,
} from '@ridefood/types';
import {
  IDS,
  VND,
  appendTicketMessage,
  createMockGoogleAuthSession,
  demoUsers,
  findUserByPhone,
  findUserByRole,
  getMockStore,
  newId,
  randomOtp,
  transitionRideStatus,
  updateOrderStatus,
} from '@ridefood/supabase';
import { ApiClientError } from './client';

function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { data, meta };
}

function pageMeta(total: number, page = 1, perPage = 20) {
  return {
    currentPage: page,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    perPage,
    total,
  };
}

function tokensFor(userId: string): AuthTokens {
  return {
    accessToken: `mock-access-${userId}`,
    refreshToken: `mock-refresh-${userId}`,
    tokenType: 'Bearer',
    expiresIn: 86_400,
  };
}

function sessionFor(role: 'rider' | 'driver' | 'partner'): AuthSession {
  const user = findUserByRole(role);
  getMockStore().currentUserId = user.id;
  return { user, tokens: tokensFor(user.id) };
}

function parsePath(path: string): { segments: string[]; query: URLSearchParams } {
  const [pathname, qs = ''] = path.split('?');
  const clean = (pathname ?? '').replace(/^\//, '');
  return {
    segments: clean.split('/').filter(Boolean),
    query: new URLSearchParams(qs),
  };
}

export async function handleMockRequest<T>(options: {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
}): Promise<T> {
  const store = getMockStore();
  const method = options.method.toUpperCase();
  let path = options.path;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) path = `${path}${path.includes('?') ? '&' : '?'}${qs}`;
  }
  const { segments, query } = parsePath(path);
  const body = (options.body ?? {}) as Record<string, unknown>;

  // AUTH
  if (segments[0] === 'auth') {
    if (segments[1] === 'login' && method === 'POST') {
      const req = body as unknown as LoginRequest;
      const byPhone = findUserByPhone(req.phone);
      const user = byPhone ?? findUserByRole(req.role);
      store.currentUserId = user.id;
      return ok({ user, tokens: tokensFor(user.id) }) as T;
    }
    if (segments[1] === 'register' && method === 'POST') {
      const session = sessionFor((body.role as 'rider') ?? 'rider');
      store.currentUserId = session.user.id;
      return ok(session) as T;
    }
    if (segments[1] === 'google' && method === 'POST') {
      const role = (body.role as 'rider' | 'driver' | 'partner') ?? 'rider';
      const marketId =
        typeof body.marketId === 'string' ? body.marketId : undefined;
      const session = createMockGoogleAuthSession({ role, marketId });
      return ok(session) as T;
    }
    if (segments[1] === 'refresh' && method === 'POST') {
      return ok(tokensFor(store.currentUserId || IDS.rider)) as T;
    }
    if (segments[1] === 'logout' && method === 'POST') {
      return ok({ ok: true }) as T;
    }
    if (segments[1] === 'me' && method === 'GET') {
      const me =
        store.users.find((u) => u.id === store.currentUserId) ?? demoUsers.rider;
      return ok(me) as T;
    }
    if (segments[1] === 'otp' && segments[2] === 'request') {
      return ok({ sent: true }) as T;
    }
  }

  // MARKETS
  if (segments[0] === 'markets') {
    if (segments.length === 1 && method === 'GET') {
      return ok(store.markets) as T;
    }
    if (segments[2] === 'vehicle-types') {
      const marketId = segments[1]!;
      return ok(store.vehicles.filter((v) => v.marketId === marketId)) as T;
    }
    if (segments[2] === 'zones') {
      const marketId = segments[1]!;
      return ok(store.zones.filter((z) => z.marketId === marketId)) as T;
    }
  }

  // RIDES
  if (segments[0] === 'rides') {
    if (segments[1] === 'estimate' && method === 'POST') {
      const vehicle = store.vehicles.find((v) => v.id === body.vehicleTypeId) ?? store.vehicles[0]!;
      const market = store.markets.find((m) => m.id === body.marketId) ?? store.markets[0]!;
      const distanceKm = 4.2;
      const durationMinutes = 14;
      const estimatedFareMinor = calculateFixedFare({
        baseFareMinor: vehicle.baseFareMinor,
        perKmMinor: vehicle.perKmMinor,
        perMinuteMinor: vehicle.perMinuteMinor,
        minFareMinor: vehicle.minFareMinor,
        distanceKm,
        durationMinutes,
      });
      const bounds = calculateBidBounds(estimatedFareMinor);
      const promoCode = typeof body.promoCode === 'string' ? body.promoCode : '';
      const promo = store.promos.find(
        (p) => p.code.toUpperCase() === promoCode.toUpperCase() && p.isActive,
      );
      const promoDiscountMinor = promo
        ? calculatePromoDiscount(estimatedFareMinor, promo)
        : 0;
      const payload: FareEstimateResponse = {
        estimatedFareMinor,
        minBidMinor: market.biddingEnabled ? bounds.minBidMinor : null,
        maxBidMinor: market.biddingEnabled ? bounds.maxBidMinor : null,
        currency: market.currency,
        pricingMode: market.pricingMode,
        distanceMeters: Math.round(distanceKm * 1000),
        durationSeconds: durationMinutes * 60,
        etaMinutes: durationMinutes,
        otpRequired: market.otpTripStartEnabled,
        promoDiscountMinor,
        subscriptionDiscountMinor: store.subscription
          ? Math.round((estimatedFareMinor * store.subscription.plan.rideDiscountPercent) / 100)
          : 0,
      };
      return ok(payload) as T;
    }

    if (segments.length === 1 && method === 'GET') {
      return { data: store.rides, meta: pageMeta(store.rides.length) } as T;
    }

    if (segments.length === 1 && method === 'POST') {
      const req = body as unknown as CreateRideRequest;
      const market = store.markets.find((m) => m.id === req.marketId) ?? store.markets[0]!;
      const vehicle = store.vehicles.find((v) => v.id === req.vehicleTypeId) ?? store.vehicles[0]!;
      const estimated =
        req.offeredFareMinor ??
        calculateFixedFare({
          baseFareMinor: vehicle.baseFareMinor,
          perKmMinor: vehicle.perKmMinor,
          perMinuteMinor: vehicle.perMinuteMinor,
          minFareMinor: vehicle.minFareMinor,
          distanceKm: 4.2,
          durationMinutes: 14,
        });
      const pricingMode = req.pricingMode ?? market.pricingMode;
      const ride: Ride = {
        id: newId('ride'),
        code: `RF-HCM-${Math.floor(10_000 + Math.random() * 89_999)}`,
        riderId: IDS.rider,
        driverId: null,
        marketId: market.id,
        vehicleTypeId: vehicle.id,
        status: pricingMode === 'bidding' ? 'bidding' : 'searching',
        pricingMode,
        isParcel: Boolean(req.isParcel),
        isIntercity: Boolean(req.isIntercity),
        scheduledAt: req.scheduledAt ?? null,
        stops: req.stops,
        distanceMeters: 4200,
        durationSeconds: 840,
        estimatedFareMinor: estimated,
        finalFareMinor: null,
        currency: market.currency,
        paymentMethod: req.paymentMethod,
        promoCodeId: null,
        subscriptionDiscountMinor: 0,
        otpCode: market.otpTripStartEnabled ? randomOtp() : null,
        otpRequired: market.otpTripStartEnabled,
        trackingToken: newId('trk'),
        rating: null,
        notes: req.notes ?? null,
        acceptedAt: null,
        arrivedAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.rides.unshift(ride);

      // Seed a couple of bids when bidding
      if (pricingMode === 'bidding') {
        const bounds = calculateBidBounds(estimated);
        store.bids.unshift(
          {
            id: newId('bid'),
            rideId: ride.id,
            driverId: IDS.driver,
            amountMinor: Math.round((bounds.minBidMinor + estimated) / 2),
            currency: VND,
            status: 'pending',
            counterAmountMinor: null,
            message: 'Tôi gần bạn',
            expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(),
            driver: {
              id: IDS.driver,
              firstName: 'Hùng',
              lastName: 'Trần',
              avatarUrl: null,
              ratingAvg: 4.92,
              vehicleLabel: 'Vios · 51A-123.45',
              etaMinutes: 5,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: newId('bid'),
            rideId: ride.id,
            driverId: IDS.driver2,
            amountMinor: estimated,
            currency: VND,
            status: 'pending',
            counterAmountMinor: null,
            message: null,
            expiresAt: new Date(Date.now() + 7 * 60_000).toISOString(),
            driver: {
              id: IDS.driver2,
              firstName: 'Tuấn',
              lastName: 'Lê',
              avatarUrl: null,
              ratingAvg: 4.8,
              vehicleLabel: 'Accent · 51G-888.88',
              etaMinutes: 8,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        );
      } else {
        // Auto-assign for fixed mode demo
        ride.status = 'accepted';
        ride.driverId = IDS.driver;
        ride.acceptedAt = new Date().toISOString();
      }

      return ok(ride) as T;
    }

    const rideId = segments[1];
    if (rideId && segments[2] === 'bids') {
      if (method === 'GET') {
        return ok(store.bids.filter((b) => b.rideId === rideId)) as T;
      }
      if (method === 'POST' && !segments[3]) {
        const amountMinor = Number(body.amountMinor ?? 0);
        const bid = {
          id: newId('bid'),
          rideId,
          driverId: IDS.driver,
          amountMinor,
          currency: VND,
          status: 'pending' as const,
          counterAmountMinor: null,
          message: (body.message as string) ?? null,
          expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(),
          driver: {
            id: IDS.driver,
            firstName: 'Hùng',
            lastName: 'Trần',
            avatarUrl: null,
            ratingAvg: 4.92,
            vehicleLabel: 'Vios · 51A-123.45',
            etaMinutes: 5,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.bids.unshift(bid);
        return ok(bid) as T;
      }
      const bidId = segments[3];
      const bid = store.bids.find((b) => b.id === bidId);
      if (!bid) throw new ApiClientError({ message: 'Bid not found', status: 404 }, 404);

      if (segments[4] === 'accept' && method === 'POST') {
        bid.status = 'accepted';
        store.bids.forEach((b) => {
          if (b.rideId === rideId && b.id !== bidId) b.status = 'rejected';
        });
        const ride = store.rides.find((r) => r.id === rideId);
        if (ride) {
          ride.status = 'accepted';
          ride.driverId = bid.driverId;
          ride.finalFareMinor = bid.amountMinor;
          ride.acceptedAt = new Date().toISOString();
          ride.otpCode = ride.otpCode ?? randomOtp();
          ride.updatedAt = new Date().toISOString();
          return ok(ride) as T;
        }
      }
      if (segments[4] === 'reject' && method === 'POST') {
        bid.status = 'rejected';
        return ok(bid) as T;
      }
      if (segments[4] === 'counter' && method === 'POST') {
        bid.status = 'countered';
        bid.counterAmountMinor = Number(body.amountMinor ?? bid.amountMinor);
        return ok(bid) as T;
      }
    }

    if (rideId && segments[2] === 'transition' && method === 'POST') {
      const idx = store.rides.findIndex((r) => r.id === rideId);
      if (idx < 0) throw new ApiClientError({ message: 'Ride not found', status: 404 }, 404);
      try {
        const updated = transitionRideStatus(
          store.rides[idx]!,
          body.action as 'accept' | 'arrive' | 'start' | 'complete' | 'cancel',
          body.otp as string | undefined,
        );
        store.rides[idx] = updated;
        if (updated.status === 'completed') {
          store.gamification.xp += 80;
          store.walletTx.unshift({
            id: newId('wtx'),
            userId: IDS.driver,
            type: 'credit',
            amountMinor: updated.finalFareMinor ?? updated.estimatedFareMinor,
            currency: VND,
            reason: `Thu nhập ${updated.code}`,
            referenceType: 'ride',
            referenceId: updated.id,
            createdAt: new Date().toISOString(),
          });
        }
        return ok(updated) as T;
      } catch (e) {
        throw new ApiClientError(
          { message: e instanceof Error ? e.message : 'Transition failed', status: 400 },
          400,
        );
      }
    }

    if (rideId && segments[2] === 'cancel' && method === 'POST') {
      const idx = store.rides.findIndex((r) => r.id === rideId);
      if (idx < 0) throw new ApiClientError({ message: 'Ride not found', status: 404 }, 404);
      store.rides[idx] = transitionRideStatus(store.rides[idx]!, 'cancel');
      return ok(store.rides[idx]) as T;
    }

    if (rideId && method === 'GET') {
      const ride = store.rides.find((r) => r.id === rideId);
      if (!ride) throw new ApiClientError({ message: 'Ride not found', status: 404 }, 404);
      return ok(ride) as T;
    }
  }

  // TRACK
  if (segments[0] === 'track') {
    if (segments[1] === 'rides') {
      const ride = store.rides.find((r) => r.trackingToken === segments[2] || r.id === segments[2]);
      if (!ride) throw new ApiClientError({ message: 'Not found', status: 404 }, 404);
      return ok(ride) as T;
    }
    if (segments[1] === 'orders') {
      const order = store.orders.find(
        (o) => o.trackingToken === segments[2] || o.id === segments[2],
      );
      if (!order) throw new ApiClientError({ message: 'Not found', status: 404 }, 404);
      return ok(order) as T;
    }
  }

  // FOOD
  if (segments[0] === 'food') {
    if (segments[1] === 'restaurants' && !segments[2] && method === 'GET') {
      const marketId = query.get('marketId');
      const q = (query.get('q') ?? '').toLowerCase();
      let list = store.restaurants;
      if (marketId) list = list.filter((r) => r.marketId === marketId);
      if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
      return { data: list, meta: pageMeta(list.length) } as T;
    }
    if (segments[1] === 'restaurants' && segments[2] && method === 'GET') {
      const restaurant = store.restaurants.find((r) => r.id === segments[2]);
      if (!restaurant) throw new ApiClientError({ message: 'Restaurant not found', status: 404 }, 404);
      const menu = store.menuItems.filter((m) => m.restaurantId === restaurant.id);
      const categories = store.menuCategories.filter((c) =>
        menu.some((m) => m.categoryId === c.id),
      );
      return ok({ ...restaurant, menu, categories }) as T;
    }
    if (segments[1] === 'orders' && method === 'GET' && !segments[2]) {
      return { data: store.orders, meta: pageMeta(store.orders.length) } as T;
    }
    if (segments[1] === 'orders' && method === 'POST') {
      const req = body as unknown as PlaceFoodOrderRequest;
      const restaurant = store.restaurants.find((r) => r.id === req.restaurantId)!;
      const zone = store.zones.find((z) => z.id === req.zoneId) ?? store.zones[0]!;
      let subtotal = 0;
      const items = req.items.map((line) => {
        const menu = store.menuItems.find((m) => m.id === line.menuItemId)!;
        const variant = menu.variants.find((v) => v.id === line.variantId);
        const addons = menu.addons.filter((a) => (line.addonIds ?? []).includes(a.id));
        const unit =
          menu.priceMinor +
          (variant?.priceDeltaMinor ?? 0) +
          addons.reduce((s, a) => s + a.priceMinor, 0);
        const lineTotal = unit * line.quantity;
        subtotal += lineTotal;
        return {
          id: newId('oi'),
          menuItemId: menu.id,
          name: menu.name,
          quantity: line.quantity,
          unitPriceMinor: unit,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          addonIds: addons.map((a) => a.id),
          addonNames: addons.map((a) => a.name),
          notes: line.notes ?? null,
          lineTotalMinor: lineTotal,
        };
      });
      const promo = req.promoCode
        ? store.promos.find((p) => p.code.toUpperCase() === req.promoCode!.toUpperCase())
        : null;
      const totals = calculateCheckoutTotals({
        subtotalMinor: subtotal,
        deliveryFeeMinor: zone.deliveryFeeMinor,
        promo: promo ?? null,
        subscription: store.subscription,
        currency: VND,
        context: 'food',
      });
      const order: FoodOrder = {
        id: newId('ord'),
        code: `FD-${Math.floor(10_000 + Math.random() * 89_999)}`,
        riderId: IDS.rider,
        restaurantId: restaurant.id,
        driverId: null,
        marketId: restaurant.marketId,
        zoneId: zone.id,
        status: 'pending',
        items,
        subtotalMinor: totals.subtotalMinor,
        deliveryFeeMinor: totals.deliveryFeeMinor,
        discountMinor: totals.promoDiscountMinor,
        totalMinor: totals.totalMinor,
        currency: VND,
        paymentMethod: req.paymentMethod,
        promoCodeId: promo?.id ?? null,
        subscriptionFreeDelivery: totals.freeDeliveryApplied,
        mergedBatchId: null,
        deliveryAddress: req.deliveryAddress,
        deliveryPoint: req.deliveryPoint,
        notes: req.notes ?? null,
        trackingToken: newId('trk'),
        estimatedDeliveryAt: new Date(Date.now() + 35 * 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.orders.unshift(order);
      return ok(order) as T;
    }
    if (segments[1] === 'orders' && segments[2] && method === 'GET') {
      const order = store.orders.find((o) => o.id === segments[2]);
      if (!order) throw new ApiClientError({ message: 'Order not found', status: 404 }, 404);
      return ok(order) as T;
    }
    if (segments[1] === 'orders' && segments[3] === 'cancel') {
      const idx = store.orders.findIndex((o) => o.id === segments[2]);
      if (idx < 0) throw new ApiClientError({ message: 'Order not found', status: 404 }, 404);
      store.orders[idx] = updateOrderStatus(store.orders[idx]!, 'cancelled');
      return ok(store.orders[idx]) as T;
    }
    if (segments[1] === 'merged-batches' && segments[2]) {
      const batch = store.batches.find((b) => b.id === segments[2]);
      if (!batch) throw new ApiClientError({ message: 'Batch not found', status: 404 }, 404);
      return ok(batch) as T;
    }
  }

  // PROMOS / SUBSCRIPTIONS / WALLET / GAMIFICATION
  if (segments[0] === 'promos' && segments[1] === 'validate') {
    const code = String(body.code ?? '').toUpperCase();
    const promo = store.promos.find((p) => p.code === code && p.isActive) ?? null;
    const subtotal = Number(body.subtotalMinor ?? 0);
    const discountMinor = promo ? calculatePromoDiscount(subtotal, promo) : 0;
    return ok({
      valid: Boolean(promo) && discountMinor > 0,
      promo,
      discountMinor,
      message: promo ? null : 'Mã không hợp lệ',
    }) as T;
  }

  if (segments[0] === 'subscriptions') {
    if (segments[1] === 'plans') return ok(store.plans) as T;
    if (segments[1] === 'current') {
      if (!store.subscription) {
        throw new ApiClientError({ message: 'No subscription', status: 404 }, 404);
      }
      return ok(store.subscription) as T;
    }
    if (method === 'POST' && !segments[1]) {
      store.subscription = {
        id: newId('sub'),
        userId: IDS.rider,
        planId: String(body.planId),
        plan: store.plans[0]!,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
        cancelAtPeriodEnd: false,
        freeDeliveryUsedThisPeriod: 0,
      };
      return ok(store.subscription) as T;
    }
    if (segments[1] === 'cancel') {
      if (store.subscription) store.subscription.cancelAtPeriodEnd = true;
      return ok(store.subscription) as T;
    }
  }

  if (segments[0] === 'wallet') {
    if (method === 'GET') {
      return ok({
        balanceMinor: demoUsers.driver.walletBalanceMinor,
        currency: VND,
        transactions: store.walletTx,
      }) as T;
    }
    if (segments[1] === 'withdrawals' && method === 'POST') {
      return ok({
        id: newId('wd'),
        driverId: IDS.driver,
        amountMinor: Number(body.amountMinor ?? 0),
        currency: VND,
        status: 'pending',
        payoutMethod: String(body.payoutMethod ?? 'momo'),
        payoutDetails: (body.payoutDetails as Record<string, string>) ?? {},
        createdAt: new Date().toISOString(),
        processedAt: null,
      }) as T;
    }
  }

  if (segments[0] === 'driver') {
    if (segments[1] === 'gamification') return ok(store.gamification) as T;
    if (segments[1] === 'presence' && method === 'POST') {
      store.driverOnline = Boolean(body.online);
      return ok({ online: store.driverOnline }) as T;
    }
    if (segments[1] === 'merged-batches') return ok(store.batches) as T;
    if (segments[1] === 'documents') return ok([]) as T;
  }

  // PARTNER
  if (segments[0] === 'partner') {
    if (segments[1] === 'orders' && method === 'GET') {
      return { data: store.orders, meta: pageMeta(store.orders.length) } as T;
    }
    if (segments[1] === 'orders' && segments[3] === 'status' && method === 'POST') {
      const idx = store.orders.findIndex((o) => o.id === segments[2]);
      if (idx < 0) throw new ApiClientError({ message: 'Order not found', status: 404 }, 404);
      store.orders[idx] = updateOrderStatus(
        store.orders[idx]!,
        body.status as FoodOrder['status'],
      );
      return ok(store.orders[idx]) as T;
    }
    if (segments[1] === 'menu' && method === 'GET') {
      const restaurant = store.restaurants.find((r) => r.id === IDS.restPho)!;
      const menu = store.menuItems.filter((m) => m.restaurantId === restaurant.id);
      return ok({
        ...restaurant,
        menu,
        categories: store.menuCategories.filter((c) => menu.some((m) => m.categoryId === c.id)),
      }) as T;
    }
    if (segments[1] === 'menu' && segments[2] === 'availability' && method === 'PATCH') {
      if (body.menuItemId) {
        const item = store.menuItems.find((m) => m.id === body.menuItemId);
        if (item) item.isAvailable = Boolean(body.isAvailable);
      }
      if (body.addonId) {
        for (const item of store.menuItems) {
          const addon = item.addons.find((a) => a.id === body.addonId);
          if (addon) addon.isAvailable = Boolean(body.isAvailable);
        }
      }
      return ok({ ok: true }) as T;
    }
  }

  // SUPPORT
  if (segments[0] === 'support') {
    if (segments[1] === 'tickets' && method === 'GET' && !segments[2]) {
      return { data: store.tickets, meta: pageMeta(store.tickets.length) } as T;
    }
    if (segments[1] === 'tickets' && method === 'POST' && !segments[2]) {
      const ticket = {
        id: newId('tkt'),
        code: `SUP-${Math.floor(1000 + Math.random() * 8999)}`,
        userId: IDS.rider,
        assigneeId: IDS.support,
        subject: String(body.subject ?? 'Support'),
        status: 'open' as const,
        priority: (body.priority as 'normal') ?? 'normal',
        relatedType: (body.relatedType as null) ?? null,
        relatedId: (body.relatedId as string) ?? null,
        refundStatus: 'none' as const,
        refundAmountMinor: null,
        messages: [
          {
            id: newId('msg'),
            ticketId: 'pending',
            senderId: IDS.rider,
            senderRole: 'rider' as const,
            body: String(body.body ?? ''),
            attachments: [],
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      ticket.messages[0]!.ticketId = ticket.id;
      store.tickets.unshift(ticket);
      return ok(ticket) as T;
    }
    if (segments[1] === 'tickets' && segments[2] && method === 'GET') {
      const ticket = store.tickets.find((t) => t.id === segments[2]);
      if (!ticket) throw new ApiClientError({ message: 'Ticket not found', status: 404 }, 404);
      return ok(ticket) as T;
    }
    if (segments[1] === 'tickets' && segments[3] === 'messages' && method === 'POST') {
      const idx = store.tickets.findIndex((t) => t.id === segments[2]);
      if (idx < 0) throw new ApiClientError({ message: 'Ticket not found', status: 404 }, 404);
      const message: SupportTicketMessage = {
        id: newId('msg'),
        ticketId: store.tickets[idx]!.id,
        senderId: IDS.rider,
        senderRole: 'rider',
        body: String(body.body ?? ''),
        attachments: (body.attachments as string[]) ?? [],
        createdAt: new Date().toISOString(),
      };
      store.tickets[idx] = appendTicketMessage(store.tickets[idx]!, message);
      // Auto agent reply in mock
      const reply: SupportTicketMessage = {
        id: newId('msg'),
        ticketId: store.tickets[idx]!.id,
        senderId: IDS.support,
        senderRole: 'support_agent',
        body: 'Cảm ơn bạn. Nhân viên GOXE sẽ phản hồi sớm (hỗ trợ người thật, không AI).',
        attachments: [],
        createdAt: new Date().toISOString(),
      };
      store.tickets[idx] = appendTicketMessage(store.tickets[idx]!, reply);
      return ok(message) as T;
    }
    if (segments[3] === 'escalate' || segments[3] === 'refund') {
      const ticket = store.tickets.find((t) => t.id === segments[2]);
      if (!ticket) throw new ApiClientError({ message: 'Ticket not found', status: 404 }, 404);
      if (segments[3] === 'escalate') ticket.status = 'escalated';
      if (segments[3] === 'refund') {
        ticket.refundStatus = 'requested';
        ticket.refundAmountMinor = Number(body.amountMinor ?? 0) || null;
      }
      return ok(ticket) as T;
    }
  }

  if (segments[0] === 'ops' && segments[1] === 'markets') {
    return ok({
      marketId: segments[2],
      marketName: 'TP. Hồ Chí Minh',
      currencyCode: 'VND',
      ridesCompletedToday: 186,
      ordersDeliveredToday: 412,
      driversOnline: store.driverOnline ? 48 : 47,
      restaurantsOpen: 126,
      rideFulfillmentRate7d: 0.94,
      rideRevenueMinorToday: 42_500_000,
      foodRevenueMinorToday: 98_200_000,
    }) as T;
  }

  if (segments[0] === 'realtime' && segments[1] === 'poll') {
    return ok([]) as T;
  }

  if (getEnv().isDev) {
    console.warn(`[mock-api] Unhandled ${method} ${path}`);
  }
  throw new ApiClientError({ message: `Mock route not found: ${method} ${path}`, status: 404 }, 404);
}
