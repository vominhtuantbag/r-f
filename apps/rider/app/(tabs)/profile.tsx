import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEnv } from '@ridefood/config';
import { formatMoney } from '@ridefood/utils';
import { useApi, useAuth } from '../../src/providers/AppProviders';
import { GOXE } from '../../src/theme/goxe';

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  if (local.length === 10) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const env = getEnv({ appVariant: 'rider' });
  const { api } = useApi();
  const { user, market, isAuthenticated, signOut } = useAuth();
  const [walletMinor, setWalletMinor] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api.wallet
      .get()
      .then((res) => setWalletMinor(res.data.balanceMinor))
      .catch(() => setWalletMinor(user?.walletBalanceMinor ?? 0));
  }, [api.wallet, isAuthenticated, user?.walletBalanceMinor]);

  const currency = market?.currency ?? {
    code: env.defaultCurrency || 'VND',
    symbol: '₫',
    decimalPlaces: 0,
    name: 'Vietnamese Dong',
  };

  // Vietnamese display order: họ + tên
  const displayName = user
    ? `${user.lastName} ${user.firstName}`.replace(/\s+/g, ' ').trim()
    : 'Khách GOXE';
  const phone = user?.phone ? formatPhoneDisplay(user.phone) : '—';

  const openHotline = useCallback(() => {
    void Linking.openURL(`tel:${GOXE.hotline}`);
  }, []);

  const menu: MenuItem[] = useMemo(
    () => [
      {
        key: 'edit',
        title: 'Chỉnh sửa hồ sơ',
        subtitle: 'Cập nhật tên và số điện thoại',
        icon: 'person-outline',
        onPress: () => router.push('/auth/login'),
      },
      {
        key: 'orders',
        title: 'Lịch sử đơn hàng',
        subtitle: 'Xem lại các đơn đã đặt',
        icon: 'receipt-outline',
        onPress: () => router.push('/(tabs)/orders'),
      },
      {
        key: 'wallet',
        title: 'Ví & giao dịch',
        subtitle: 'Nạp tiền, xem lịch sử ví',
        icon: 'wallet-outline',
        onPress: () => router.push('/(tabs)/profile'),
      },
      {
        key: 'rewards',
        title: 'Điểm thưởng',
        subtitle: 'Tích điểm & vòng quay may mắn',
        icon: 'gift-outline',
        onPress: () => router.push('/(tabs)/notifications'),
      },
      {
        key: 'drivers',
        title: 'Tài xế yêu thích',
        subtitle: 'Quản lý tài xế bạn tin tưởng',
        icon: 'heart-outline',
        onPress: () => router.push('/(tabs)/orders'),
      },
      {
        key: 'support',
        title: 'Hỗ trợ',
        subtitle: `Hotline ${GOXE.hotline}`,
        icon: 'headset-outline',
        onPress: () => {
          void openHotline();
          router.push('/support/chat');
        },
      },
      {
        key: 'about',
        title: `Về ${env.brandName}`,
        subtitle: 'Super App Việt Nam',
        icon: 'information-circle-outline',
        onPress: () => router.push('/support/chat'),
      },
    ],
    [env.brandName, openHotline, router],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[GOXE.tealDark, GOXE.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 28 }]}
        >
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.phone}>{phone}</Text>

          <View style={styles.walletCard}>
            <View style={styles.walletLeft}>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.walletLabel}>Ví {env.brandName}</Text>
                <Text style={styles.walletBalance}>
                  {formatMoney(walletMinor || user?.walletBalanceMinor || 0, {
                    currency,
                    locale: 'vi-VN',
                  }).replace('₫', 'đ')}
                </Text>
              </View>
            </View>
            <Pressable style={styles.topUpBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.topUpLabel}>Nạp tiền</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.menuCard}>
            {menu.map((item, index) => (
              <Pressable
                key={item.key}
                style={[styles.menuRow, index > 0 && styles.menuRowBorder]}
                onPress={item.onPress}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon} size={18} color={GOXE.tealDark} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSub}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C2CDD0" />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              if (isAuthenticated) void signOut();
              else router.push('/auth/login');
            }}
          >
            <Text style={styles.logoutLabel}>
              {isAuthenticated ? 'Đăng xuất' : 'Đăng nhập'}
            </Text>
          </Pressable>

          {isAuthenticated ? (
            <Pressable style={styles.deleteLink}>
              <Text style={styles.deleteLabel}>Xóa tài khoản</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOXE.bg },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  phone: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  walletCard: {
    marginTop: 18,
    width: '100%',
    backgroundColor: 'rgba(8, 70, 78, 0.28)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  walletBalance: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 1 },
  topUpBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topUpLabel: { color: GOXE.tealDark, fontWeight: '700', fontSize: 13 },
  body: { paddingHorizontal: 16, marginTop: -8, gap: 14 },
  menuCard: {
    backgroundColor: GOXE.surface,
    borderRadius: 18,
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 6px 18px rgba(8,30,34,0.08)' } as object,
      default: {},
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    gap: 12,
  },
  menuRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GOXE.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GOXE.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: GOXE.text },
  menuSub: { marginTop: 2, fontSize: 12, color: GOXE.textMuted },
  logoutBtn: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: GOXE.danger,
    backgroundColor: GOXE.surface,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutLabel: { color: GOXE.danger, fontWeight: '700', fontSize: 15 },
  deleteLink: { alignItems: 'center', paddingVertical: 8 },
  deleteLabel: { color: GOXE.danger, fontSize: 13, fontWeight: '600' },
});
