import type { HomeScreenData } from '../types';

const PLACEHOLDER = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=400&q=80`;

export function createHomeMockData(brandName = 'GOXE'): HomeScreenData {
  return {
    locationCaption: 'Giao đến',
    locationLabel: 'Sông Đốc, Cà Mau',
    promoCount: 3,
    searchPlaceholder: `Tìm món ăn, đặt xe ${brandName}...`,
    services: [
      { id: 'parcel', label: 'Gửi hàng', icon: 'parcel', tint: '#FFE8C8' },
      { id: 'bike', label: 'Gọi xe', icon: 'bike', tint: '#D6F4F7' },
      { id: 'car', label: 'Ô tô', icon: 'car', tint: '#D9EEFF' },
      { id: 'truck', label: 'Xe tải', icon: 'truck', tint: '#E4ECFF' },
      { id: 'food', label: 'Đồ ăn', icon: 'food', tint: '#FFE4D6' },
      { id: 'grocery', label: 'Đi chợ hộ', icon: 'grocery', tint: '#E4F7E2' },
      { id: 'retail', label: 'Tiêu dùng', icon: 'retail', tint: '#EDE4FF' },
      { id: 'pet', label: 'Chăm sóc pet', icon: 'pet', tint: '#FFE8F0' },
    ],
    banners: [
      {
        id: 'b1',
        title: `200 QUÁN ĂN - UỐNG ĐÃ CÓ TRÊN ${brandName}`,
        subtitle: 'Món ngon Sông Đốc, tha hồ lựa!',
        ctaLabel: 'KHÁM PHÁ NGAY',
        accent: '#24B8C4',
      },
      {
        id: 'b2',
        title: 'ƯU ĐÃI ĐẶT XE GIỜ CAO ĐIỂM',
        subtitle: 'Giảm đến 20.000đ cho chuyến đầu trong ngày',
        ctaLabel: 'ĐẶT NGAY',
        accent: '#1BA8B5',
      },
      {
        id: 'b3',
        title: 'GỬI HÀNG NỘI THÀNH SIÊU TỐC',
        subtitle: 'Ship nhanh trong Sông Đốc & Cà Mau',
        ctaLabel: 'GỬI NGAY',
        accent: '#1496A3',
      },
    ],
    sections: [
      {
        id: 'new',
        title: 'Quán mới lên sàn',
        subtitle: `Vừa tham gia ${brandName} — ghé ủng hộ nhé`,
        icon: 'new',
        merchants: [
          {
            id: 'm1',
            name: 'Hột Vịt Nhà Phượng',
            rating: 5.0,
            distanceKm: 2.0,
            imageUrl: PLACEHOLDER('1546069901-ba9599a7e63c'),
            isNew: true,
            isClosed: true,
          },
          {
            id: 'm2',
            name: 'TIỆM NHÀ KIM',
            rating: 5.0,
            distanceKm: 2.0,
            imageUrl: PLACEHOLDER('1565299624946-b28f40a0ae38'),
            isNew: true,
          },
          {
            id: 'm3',
            name: 'Tiệm Nướng Biển Đông',
            rating: 4.9,
            distanceKm: 1.6,
            imageUrl: PLACEHOLDER('1504674900247-0877df9cc836'),
            isNew: true,
          },
        ],
      },
      {
        id: 'nearby',
        title: 'Món ngon gần bạn',
        subtitle: 'Quán được đánh giá cao gần bạn',
        icon: 'nearby',
        merchants: [
          {
            id: 'n1',
            name: 'Bún Nước Lèo Cô Ba',
            rating: 5.0,
            distanceKm: 0.8,
            imageUrl: PLACEHOLDER('1555939594-58d7dc85a63c'),
            isFavorite: true,
          },
          {
            id: 'n2',
            name: 'Cà Phê Sông Đốc',
            rating: 4.8,
            distanceKm: 1.2,
            imageUrl: PLACEHOLDER('1495474472287-4d71bcdd2085'),
            isClosed: true,
          },
          {
            id: 'n3',
            name: 'Ốc Biển Cà Mau',
            rating: 4.9,
            distanceKm: 2.4,
            imageUrl: PLACEHOLDER('1559339352-11d035aa65de'),
            isFavorite: false,
          },
        ],
      },
    ],
    voucher: {
      eyebrow: 'ƯU ĐÃI HÔM NAY',
      title: 'Săn voucher siêu hời',
      subtitle: 'Ưu đãi mới mỗi ngày, số lượng có hạn',
      ctaLabel: 'Xem ngay',
    },
    partnerCta: {
      title: 'Đăng ký bán hàng',
      subtitle: `Mở quán trên ${brandName} · Đăng ký chủ quán`,
    },
  };
}
