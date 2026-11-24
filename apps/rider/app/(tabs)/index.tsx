import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  HomeHeader,
  MerchantCarouselSection,
  MerchantCtaCard,
  PromoBannerCarousel,
  ServiceGrid,
  VoucherBannerCard,
} from '../../src/features/home/components';
import { useHomeData } from '../../src/features/home/hooks/useHomeData';
import type { HomeMerchantCard, ServiceAction } from '../../src/features/home/types';
import { useAuth } from '../../src/providers/AppProviders';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const { data, setData, market } = useHomeData();
  const contentMax = Math.min(width, 560);
  const styles = useMemo(() => createStyles(contentMax), [contentMax]);

  const openAuthIfNeeded = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return true;
    }
    return false;
  }, [isAuthenticated, router]);

  const onService = useCallback(
    (id: ServiceAction) => {
      switch (id) {
        case 'food':
        case 'grocery':
        case 'retail':
        case 'pet':
          router.push('/(tabs)/food');
          return;
        case 'parcel':
          if (openAuthIfNeeded()) return;
          router.push({
            pathname: '/ride/book',
            params: { parcel: '1', marketId: market?.id ?? '' },
          });
          return;
        case 'bike':
        case 'car':
        case 'truck':
          if (openAuthIfNeeded()) return;
          router.push({
            pathname: '/ride/book',
            params: { marketId: market?.id ?? '' },
          });
          return;
        default:
          return;
      }
    },
    [market?.id, openAuthIfNeeded, router],
  );

  const onMerchant = useCallback(
    (merchant: HomeMerchantCard) => {
      router.push({ pathname: '/food/restaurant/[id]', params: { id: merchant.id } });
    },
    [router],
  );

  const toggleFavorite = useCallback((merchant: HomeMerchantCard) => {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => ({
        ...section,
        merchants: section.merchants.map((m) =>
          m.id === merchant.id ? { ...m, isFavorite: !m.isFavorite } : m,
        ),
      })),
    }));
  }, [setData]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <HomeHeader
            locationCaption={data.locationCaption}
            locationLabel={market?.name ?? data.locationLabel}
            promoCount={data.promoCount}
            searchPlaceholder={data.searchPlaceholder}
            onMenuPress={() => router.push('/(tabs)/profile')}
            onLocationPress={() => router.push('/(tabs)/profile')}
            onPromoPress={() => router.push('/(tabs)/notifications')}
            onSearchPress={() => router.push('/(tabs)/food')}
          />

          <ServiceGrid items={data.services} onPressService={onService} />

          <PromoBannerCarousel
            banners={data.banners}
            onPressCta={() => router.push('/(tabs)/food')}
          />

          {data.sections.map((section) => (
            <MerchantCarouselSection
              key={section.id}
              section={section}
              showFavorite={section.id === 'nearby'}
              onPressSeeAll={() => router.push('/(tabs)/food')}
              onPressMerchant={onMerchant}
              onToggleFavorite={toggleFavorite}
            />
          ))}

          <VoucherBannerCard
            voucher={data.voucher}
            onPress={() => router.push('/(tabs)/notifications')}
          />

          <MerchantCtaCard
            title={data.partnerCta.title}
            subtitle={data.partnerCta.subtitle}
            onPress={() => router.push('/support/chat')}
          />

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(contentMax: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    scroll: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    scrollContent: {
      alignItems: 'center',
      paddingBottom: 12,
    },
    column: {
      width: '100%',
      maxWidth: contentMax,
      backgroundColor: '#FFFFFF',
    },
    bottomSpacer: {
      height: 12,
    },
  });
}
