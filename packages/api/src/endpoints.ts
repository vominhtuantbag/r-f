import type {
  ApplyPromoRequest,
  AuthSession,
  AuthTokens,
  BidCreateRequest,
  BidResponse,
  BidsResponse,
  CounterBidRequest,
  CreateRideRequest,
  DocumentsResponse,
  FareEstimateRequest,
  FareEstimateResponse,
  FoodOrderResponse,
  FoodOrdersResponse,
  GamificationResponse,
  GoogleAuthRequest,
  LoginRequest,
  MarketsResponse,
  MeResponse,
  MenuAvailabilityUpdate,
  MergedBatchResponse,
  PartnerOrderStatusUpdate,
  PlaceFoodOrderRequest,
  PlansResponse,
  PromoValidateResponse,
  RegisterRequest,
  RestaurantDetailResponse,
  RestaurantsResponse,
  RideResponse,
  RidesResponse,
  SubscribeRequest,
  SubscriptionResponse,
  SupportMessageRequest,
  SupportMessageResponse,
  SupportTicketCreateRequest,
  SupportTicketResponse,
  SupportTicketsResponse,
  TripTransitionRequest,
  VehicleTypesResponse,
  WalletResponse,
  WithdrawalCreateRequest,
  WithdrawalResponse,
  ZonesResponse,
  ApiSuccess,
  MarketKpisResponse,
} from '@ridefood/types';
import type { ApiClient } from './client';

export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      login: (body: LoginRequest) =>
        client.post<ApiSuccess<AuthSession>>('/auth/login', body, false),
      register: (body: RegisterRequest) =>
        client.post<ApiSuccess<AuthSession>>('/auth/register', body, false),
      google: (body: GoogleAuthRequest) =>
        client.post<ApiSuccess<AuthSession>>('/auth/google', body, false),
      refresh: (refreshToken: string) =>
        client.post<ApiSuccess<AuthTokens>>('/auth/refresh', { refreshToken }, false),
      logout: () => client.post<ApiSuccess<{ ok: true }>>('/auth/logout'),
      me: () => client.get<MeResponse>('/auth/me'),
      requestOtp: (phone: string) =>
        client.post<ApiSuccess<{ sent: boolean }>>('/auth/otp/request', { phone }, false),
    },

    markets: {
      list: () => client.get<MarketsResponse>('/markets', undefined, false),
      vehicles: (marketId: string) =>
        client.get<VehicleTypesResponse>(`/markets/${marketId}/vehicle-types`, undefined, false),
      zones: (marketId: string) =>
        client.get<ZonesResponse>(`/markets/${marketId}/zones`, undefined, false),
    },

    rides: {
      estimate: (body: FareEstimateRequest) =>
        client.post<ApiSuccess<FareEstimateResponse>>('/rides/estimate', body),
      create: (body: CreateRideRequest) => client.post<RideResponse>('/rides', body),
      list: (query?: { status?: string; page?: number }) =>
        client.get<RidesResponse>('/rides', query),
      get: (id: string) => client.get<RideResponse>(`/rides/${id}`),
      cancel: (id: string, reason?: string) =>
        client.post<RideResponse>(`/rides/${id}/cancel`, { reason }),
      transition: (id: string, body: TripTransitionRequest) =>
        client.post<RideResponse>(`/rides/${id}/transition`, body),
      publicTrack: (token: string) =>
        client.get<RideResponse>(`/track/rides/${token}`, undefined, false),
    },

    bidding: {
      listForRide: (rideId: string) => client.get<BidsResponse>(`/rides/${rideId}/bids`),
      create: (body: BidCreateRequest) =>
        client.post<BidResponse>(`/rides/${body.rideId}/bids`, {
          amountMinor: body.amountMinor,
          message: body.message,
        }),
      accept: (rideId: string, bidId: string) =>
        client.post<RideResponse>(`/rides/${rideId}/bids/${bidId}/accept`),
      reject: (rideId: string, bidId: string) =>
        client.post<BidResponse>(`/rides/${rideId}/bids/${bidId}/reject`),
      counter: (rideId: string, bidId: string, body: CounterBidRequest) =>
        client.post<BidResponse>(`/rides/${rideId}/bids/${bidId}/counter`, body),
    },

    food: {
      restaurants: (query: {
        marketId: string;
        zoneId?: string;
        q?: string;
        page?: number;
      }) => client.get<RestaurantsResponse>('/food/restaurants', query, false),
      restaurant: (id: string) =>
        client.get<RestaurantDetailResponse>(`/food/restaurants/${id}`, undefined, false),
      placeOrder: (body: PlaceFoodOrderRequest) =>
        client.post<FoodOrderResponse>('/food/orders', body),
      orders: (query?: { status?: string; page?: number }) =>
        client.get<FoodOrdersResponse>('/food/orders', query),
      order: (id: string) => client.get<FoodOrderResponse>(`/food/orders/${id}`),
      cancelOrder: (id: string, reason?: string) =>
        client.post<FoodOrderResponse>(`/food/orders/${id}/cancel`, { reason }),
      publicTrack: (token: string) =>
        client.get<FoodOrderResponse>(`/track/orders/${token}`, undefined, false),
    },

    merging: {
      batch: (id: string) => client.get<MergedBatchResponse>(`/food/merged-batches/${id}`),
      driverQueue: () => client.get<ApiSuccess<import('@ridefood/types').MergedOrderBatch[]>>(
        '/driver/merged-batches',
      ),
    },

    promos: {
      validate: (body: ApplyPromoRequest) =>
        client.post<PromoValidateResponse>('/promos/validate', body),
    },

    subscriptions: {
      plans: (marketId?: string) =>
        client.get<PlansResponse>('/subscriptions/plans', { marketId }, false),
      current: () => client.get<SubscriptionResponse>('/subscriptions/current'),
      subscribe: (body: SubscribeRequest) =>
        client.post<SubscriptionResponse>('/subscriptions', body),
      cancel: () => client.post<SubscriptionResponse>('/subscriptions/cancel'),
    },

    wallet: {
      get: () => client.get<WalletResponse>('/wallet'),
      withdraw: (body: WithdrawalCreateRequest) =>
        client.post<WithdrawalResponse>('/wallet/withdrawals', body),
    },

    gamification: {
      profile: () => client.get<GamificationResponse>('/driver/gamification'),
    },

    support: {
      tickets: (query?: { page?: number; status?: string }) =>
        client.get<SupportTicketsResponse>('/support/tickets', query),
      create: (body: SupportTicketCreateRequest) =>
        client.post<SupportTicketResponse>('/support/tickets', body),
      get: (id: string) => client.get<SupportTicketResponse>(`/support/tickets/${id}`),
      message: (id: string, body: SupportMessageRequest) =>
        client.post<SupportMessageResponse>(`/support/tickets/${id}/messages`, body),
      escalate: (id: string) =>
        client.post<SupportTicketResponse>(`/support/tickets/${id}/escalate`),
      requestRefund: (id: string, amountMinor?: number) =>
        client.post<SupportTicketResponse>(`/support/tickets/${id}/refund`, { amountMinor }),
    },

    ops: {
      /** Deterministic KPIs from Supabase view `v_market_kpis` (no AI). */
      marketKpis: (marketId: string) =>
        client.get<MarketKpisResponse>(`/ops/markets/${marketId}/kpis`),
    },

    driver: {
      setOnline: (online: boolean, point?: { lat: number; lng: number }) =>
        client.post<ApiSuccess<{ online: boolean }>>('/driver/presence', { online, ...point }),
      documents: () => client.get<DocumentsResponse>('/driver/documents'),
      uploadDocument: (form: FormData) =>
        client.request<DocumentsResponse>({
          method: 'POST',
          path: '/driver/documents',
          body: form as unknown,
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
    },

    partner: {
      orders: (query?: { status?: string; page?: number }) =>
        client.get<FoodOrdersResponse>('/partner/orders', query),
      updateOrderStatus: (orderId: string, body: PartnerOrderStatusUpdate) =>
        client.post<FoodOrderResponse>(`/partner/orders/${orderId}/status`, body),
      updateAvailability: (body: MenuAvailabilityUpdate) =>
        client.patch<ApiSuccess<{ ok: true }>>('/partner/menu/availability', body),
      menu: () =>
        client.get<RestaurantDetailResponse>('/partner/menu'),
    },
  };
}

export type RideFoodApi = ReturnType<typeof createEndpoints>;

export function createRideFoodApi(client: ApiClient): RideFoodApi {
  return createEndpoints(client);
}
