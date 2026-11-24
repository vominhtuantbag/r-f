import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { HomeMerchantCard, HomeMerchantSection } from '../types';

export interface MerchantCarouselSectionProps {
  section: HomeMerchantSection;
  showFavorite?: boolean;
  onPressSeeAll?: (sectionId: string) => void;
  onPressMerchant?: (merchant: HomeMerchantCard) => void;
  onToggleFavorite?: (merchant: HomeMerchantCard) => void;
}

export function MerchantCarouselSection({
  section,
  showFavorite = false,
  onPressSeeAll,
  onPressMerchant,
  onToggleFavorite,
}: MerchantCarouselSectionProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            {section.icon === 'new' ? (
              <MaterialCommunityIcons name="store-plus" size={18} color="#24B8C4" />
            ) : (
              <Ionicons name="restaurant" size={18} color="#24B8C4" />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {section.subtitle}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => onPressSeeAll?.(section.id)} hitSlop={8}>
          <Text style={styles.seeAll}>Xem tất cả {'>'}</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={section.merchants}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onPressMerchant?.(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <View style={styles.imageWrap}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imageFallback]} />
              )}

              {item.isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>MỚI</Text>
                </View>
              ) : null}

              {item.isClosed ? (
                <View style={styles.closedOverlay}>
                  <Text style={styles.closedText}>Đóng cửa</Text>
                </View>
              ) : null}

              {showFavorite ? (
                <Pressable
                  style={styles.heart}
                  onPress={() => onToggleFavorite?.(item)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={item.isFavorite ? 'heart' : 'heart-outline'}
                    size={16}
                    color={item.isFavorite ? '#E74C3C' : '#1A2B2E'}
                  />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={styles.meta}>
                {item.rating.toFixed(1)} · {item.distanceKm.toFixed(1)} km
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E6F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A2B2E',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7C80',
  },
  seeAll: {
    color: '#24B8C4',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 132,
  },
  imageWrap: {
    width: 132,
    height: 132,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8F0F2',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: '#D5E4E7',
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#2F80ED',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B2E',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  meta: {
    fontSize: 12,
    color: '#6B7C80',
    fontWeight: '500',
  },
});
