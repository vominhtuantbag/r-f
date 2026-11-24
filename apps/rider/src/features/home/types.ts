export type ServiceAction =
  | 'parcel'
  | 'bike'
  | 'car'
  | 'truck'
  | 'food'
  | 'grocery'
  | 'retail'
  | 'pet';

export interface HomeServiceItem {
  id: ServiceAction;
  label: string;
  icon: ServiceAction;
  tint: string;
}

export interface HomePromoBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  accent: string;
}

export interface HomeMerchantCard {
  id: string;
  name: string;
  rating: number;
  distanceKm: number;
  imageUrl: string | null;
  isNew?: boolean;
  isClosed?: boolean;
  isFavorite?: boolean;
}

export interface HomeMerchantSection {
  id: string;
  title: string;
  subtitle: string;
  icon: 'new' | 'nearby';
  merchants: HomeMerchantCard[];
}

export interface HomeVoucherBanner {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
}

export interface HomeScreenData {
  locationLabel: string;
  locationCaption: string;
  promoCount: number;
  searchPlaceholder: string;
  services: HomeServiceItem[];
  banners: HomePromoBanner[];
  sections: HomeMerchantSection[];
  voucher: HomeVoucherBanner;
  partnerCta: {
    title: string;
    subtitle: string;
  };
}
