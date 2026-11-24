import React, { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { HomePromoBanner } from '../types';

export interface PromoBannerCarouselProps {
  banners: HomePromoBanner[];
  onPressCta?: (banner: HomePromoBanner) => void;
}

export function PromoBannerCarousel({ banners, onPressCta }: PromoBannerCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, 560);
  const sidePad = 16;
  const cardWidth = contentWidth - sidePad * 2;
  const [index, setIndex] = useState(0);
  const scrolling = useRef(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / (cardWidth + 12));
    if (next !== index && next >= 0 && next < banners.length) setIndex(next);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sidePad, gap: 12 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          scrolling.current = true;
        }}
        onMomentumScrollEnd={() => {
          scrolling.current = false;
        }}
      >
        {banners.map((banner) => (
          <LinearGradient
            key={banner.id}
            colors={['#B8F0F5', '#7EDCE6', banner.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { width: cardWidth }]}
          >
            <View style={styles.copy}>
              <Text style={styles.title}>{banner.title}</Text>
              <Text style={styles.subtitle}>{banner.subtitle}</Text>
              <Pressable
                style={styles.cta}
                onPress={() => onPressCta?.(banner)}
                accessibilityRole="button"
              >
                <Text style={styles.ctaLabel}>{banner.ctaLabel} {'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.art}>
              <View style={styles.stallRow}>
                <View style={[styles.stall, { backgroundColor: '#FFD166' }]}>
                  <Text style={styles.stallEmoji}>🍜</Text>
                </View>
                <View style={[styles.stall, { backgroundColor: '#06D6A0' }]}>
                  <Text style={styles.stallEmoji}>🧋</Text>
                </View>
                <View style={[styles.stall, { backgroundColor: '#EF476F' }]}>
                  <Text style={styles.stallEmoji}>🍟</Text>
                </View>
              </View>
              <View style={styles.mascot}>
                <Text style={styles.mascotEmoji}>🛵</Text>
              </View>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {banners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    minHeight: 148,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  copy: {
    flex: 1.2,
    justifyContent: 'center',
    gap: 6,
    paddingRight: 8,
  },
  title: {
    color: '#0E3A40',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  subtitle: {
    color: '#1A2B2E',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#24B8C4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  art: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stallRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  stall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stallEmoji: { fontSize: 14 },
  mascot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: { fontSize: 34 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9D8DB',
  },
  dotActive: {
    backgroundColor: '#24B8C4',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
