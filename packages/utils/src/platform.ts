import { Linking, Platform, Share } from 'react-native';
import { getEnv } from '@ridefood/config';

export type AppPlatform = 'ios' | 'android' | 'web';

export function getAppPlatform(): AppPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function isNative(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function selectPlatform<T>(values: {
  ios?: T;
  android?: T;
  web?: T;
  native?: T;
  default: T;
}): T {
  const platform = getAppPlatform();
  if (platform === 'web' && values.web !== undefined) return values.web;
  if (platform === 'ios' && values.ios !== undefined) return values.ios;
  if (platform === 'android' && values.android !== undefined) return values.android;
  if (isNative() && values.native !== undefined) return values.native;
  return values.default;
}

export type TrackingKind = 'ride' | 'order';

export function buildTrackingUrl(kind: TrackingKind, token: string, baseUrl?: string): string {
  const root = (baseUrl ?? getEnv().trackingWebBaseUrl).replace(/\/$/, '');
  const segment = kind === 'ride' ? 'rides' : 'orders';
  return `${root}/${segment}/${encodeURIComponent(token)}`;
}

export async function shareTrackingLink(options: {
  kind: TrackingKind;
  token: string;
  title?: string;
  message?: string;
}): Promise<{ shared: boolean; url: string }> {
  const url = buildTrackingUrl(options.kind, options.token);
  const title = options.title ?? 'Track your Ride & Food trip';
  const message = options.message ?? `Follow live updates: ${url}`;

  if (isWeb()) {
    const nav = globalThis.navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
      clipboard?: { writeText: (value: string) => Promise<void> };
    };

    if (typeof nav.share === 'function') {
      await nav.share({ title, text: message, url });
      return { shared: true, url };
    }

    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return { shared: true, url };
    }

    return { shared: false, url };
  }

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { url, message: options.message ?? title }
        : { message: `${message}`, title },
    );
    return { shared: result.action !== Share.dismissedAction, url };
  } catch {
    return { shared: false, url };
  }
}

export async function openTel(phone: string): Promise<void> {
  const url = `tel:${phone.replace(/\s+/g, '')}`;
  const can = await Linking.canOpenURL(url);
  if (can) await Linking.openURL(url);
}

export async function openMapsDirections(lat: number, lng: number, label?: string): Promise<void> {
  const encodedLabel = encodeURIComponent(label ?? 'Destination');
  const url = selectPlatform({
    ios: `maps:0,0?q=${encodedLabel}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
    web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  await Linking.openURL(url);
}

/** Safe area / header offset hints for Expo Router layouts. */
export function platformLayoutHints() {
  return {
    tabBarHeight: selectPlatform({ ios: 88, android: 64, web: 56, default: 64 }),
    headerHeight: selectPlatform({ ios: 96, android: 56, web: 64, default: 56 }),
    usesHover: isWeb(),
  };
}
