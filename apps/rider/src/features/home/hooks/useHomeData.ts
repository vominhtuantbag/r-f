import { useEffect, useState } from 'react';
import { getEnv } from '@ridefood/config';
import { createHomeMockData } from '../data/homeMock';
import type { HomeMerchantCard, HomeScreenData } from '../types';
import { useApi, useAuth } from '../../../providers/AppProviders';

/** Hydrates mock home content with live market + restaurants when API is available. */
export function useHomeData() {
  const env = getEnv({ appVariant: 'rider' });
  const { api } = useApi();
  const { market, setMarket } = useAuth();
  const [data, setData] = useState<HomeScreenData>(() => createHomeMockData(env.brandName));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.markets.list();
        const first = res.data[0];
        if (!alive || !first) return;
        if (!market) setMarket(first);

        const restaurants = await api.food
          .restaurants({ marketId: first.id, page: 1 })
          .catch(() => null);

        if (!alive) return;

        setData((prev) => ({
          ...prev,
          locationLabel: first.name,
        }));

        if (!restaurants?.data?.length) return;

        const mapped: HomeMerchantCard[] = restaurants.data.slice(0, 8).map((r, i) => ({
          id: r.id,
          name: r.name,
          rating: r.ratingAvg || 5,
          distanceKm: 1 + (i % 4) * 0.4,
          imageUrl: r.coverUrl ?? r.logoUrl,
          isNew: i < 3,
          isClosed: !r.isOpen,
          isFavorite: false,
        }));

        setData((prev) => ({
          ...prev,
          locationLabel: first.name,
          sections: prev.sections.map((section, idx) => ({
            ...section,
            merchants: mapped.slice(idx * 3, idx * 3 + 3).length
              ? mapped.slice(idx * 3, idx * 3 + 3)
              : section.merchants,
          })),
        }));
      } catch {
        // offline → keep Vietnamese mock dataset
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.food, api.markets, market, setMarket]);

  return { data, setData, market };
}
