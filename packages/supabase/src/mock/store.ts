import type {
  FareBid,
  FoodOrder,
  FoodOrderStatus,
  GamificationProfile,
  MenuItem,
  MergedOrderBatch,
  Ride,
  RideStatus,
  SupportTicket,
  SupportTicketMessage,
  User,
  UserSubscription,
  WalletTransaction,
} from '@ridefood/types';
import {
  createSeedBatches,
  createSeedBids,
  createSeedGamification,
  createSeedOrders,
  createSeedRides,
  createSeedSubscription,
  createSeedTicket,
  createSeedWalletTx,
  demoUsers,
  markets,
  menuCategories,
  menuItems,
  mergeRules,
  plans,
  promos,
  restaurants,
  vehicles,
  zones,
  IDS,
  VND,
} from './seed';

export interface MockStore {
  users: User[];
  markets: typeof markets;
  zones: typeof zones;
  vehicles: typeof vehicles;
  restaurants: typeof restaurants;
  menuItems: MenuItem[];
  menuCategories: typeof menuCategories;
  rides: Ride[];
  bids: FareBid[];
  orders: FoodOrder[];
  batches: MergedOrderBatch[];
  promos: typeof promos;
  plans: typeof plans;
  subscription: UserSubscription | null;
  gamification: GamificationProfile;
  tickets: SupportTicket[];
  walletTx: WalletTransaction[];
  driverOnline: boolean;
  mergeRules: typeof mergeRules;
  /** Last authenticated user id (mock session). */
  currentUserId: string;
}

let store: MockStore | null = null;

export function getMockStore(): MockStore {
  if (!store) {
    store = {
      users: Object.values(demoUsers),
      markets: [...markets],
      zones: [...zones],
      vehicles: [...vehicles],
      restaurants: [...restaurants],
      menuItems: menuItems.map((m) => ({
        ...m,
        variants: m.variants.map((v) => ({ ...v })),
        addons: m.addons.map((a) => ({ ...a })),
      })),
      menuCategories: [...menuCategories],
      rides: createSeedRides(),
      bids: createSeedBids(),
      orders: createSeedOrders(),
      batches: createSeedBatches(),
      promos: [...promos],
      plans: [...plans],
      subscription: createSeedSubscription(),
      gamification: createSeedGamification(),
      tickets: [createSeedTicket()],
      walletTx: createSeedWalletTx(),
      driverOnline: false,
      mergeRules: { ...mergeRules },
      currentUserId: IDS.rider,
    };
  }
  return store;
}

export function resetMockStore(): void {
  store = null;
  getMockStore();
}

export function findUserByRole(role: User['role']): User {
  const s = getMockStore();
  return s.users.find((u) => u.role === role) ?? demoUsers.rider;
}

export function findUserByPhone(phone: string): User | undefined {
  const normalized = phone.replace(/\s+/g, '');
  return getMockStore().users.find(
    (u) => u.phone.replace(/\s+/g, '') === normalized || u.phone.endsWith(normalized.slice(-9)),
  );
}

export function transitionRideStatus(
  ride: Ride,
  action: 'accept' | 'arrive' | 'start' | 'complete' | 'cancel',
  otp?: string | null,
): Ride {
  const ts = new Date().toISOString();
  const next: Ride = { ...ride, updatedAt: ts };

  switch (action) {
    case 'accept':
      next.status = 'accepted';
      next.driverId = next.driverId ?? IDS.driver;
      next.acceptedAt = ts;
      if (next.otpRequired && !next.otpCode) {
        next.otpCode = String(Math.floor(1000 + Math.random() * 9000));
      }
      break;
    case 'arrive':
      next.status = 'driver_arrived';
      next.arrivedAt = ts;
      break;
    case 'start':
      if (next.otpRequired) {
        if (!otp || otp !== next.otpCode) {
          throw new Error('Mã OTP không đúng');
        }
      }
      next.status = 'in_progress';
      next.startedAt = ts;
      break;
    case 'complete':
      next.status = 'completed';
      next.completedAt = ts;
      next.finalFareMinor = next.finalFareMinor ?? next.estimatedFareMinor;
      break;
    case 'cancel':
      next.status = 'cancelled';
      next.cancelledAt = ts;
      break;
    default:
      break;
  }
  return next;
}

export function updateOrderStatus(order: FoodOrder, status: FoodOrderStatus): FoodOrder {
  return { ...order, status, updatedAt: new Date().toISOString() };
}

export function appendTicketMessage(
  ticket: SupportTicket,
  message: SupportTicketMessage,
): SupportTicket {
  return {
    ...ticket,
    messages: [...ticket.messages, message],
    updatedAt: new Date().toISOString(),
  };
}

export { IDS, VND, demoUsers };
