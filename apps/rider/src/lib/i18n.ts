import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import { getEnv } from '@ridefood/config';

const en = {
  tabs: {
    rides: 'Rides',
    food: 'Food',
    orders: 'Orders',
    profile: 'Profile',
  },
  rides: {
    title: 'Where to?',
    book: 'Book a ride',
    parcel: 'Send a parcel',
    intercity: 'Inter-city',
    scheduled: 'Schedule',
  },
  food: {
    title: 'Food near you',
    search: 'Search restaurants or dishes',
    freeDelivery: 'Free delivery with membership',
  },
  checkout: {
    promo: 'Promo code',
    apply: 'Apply',
    pay: 'Place order',
    wallet: 'Wallet',
    cash: 'Cash',
  },
  support: {
    title: 'Live support',
    escalate: 'Escalate',
    refund: 'Request refund',
  },
  common: {
    continue: 'Continue',
    cancel: 'Cancel',
    loading: 'Loading…',
    error: 'Something went wrong',
  },
};

const ar = {
  ...en,
  tabs: {
    rides: 'الرحلات',
    food: 'الطعام',
    orders: 'الطلبات',
    profile: 'حسابي',
  },
};

export const i18n = new I18n({ en, ar });
i18n.enableFallback = true;
i18n.defaultLocale = getEnv().defaultLocale;

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? getEnv().defaultLocale;
i18n.locale = deviceLocale;

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export function setLocale(locale: string): void {
  i18n.locale = locale;
}
