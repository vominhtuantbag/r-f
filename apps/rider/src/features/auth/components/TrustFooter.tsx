import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOXE } from '../../../theme/goxe';
import type { AuthTab } from '../types';

const TRUST = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'An toàn',
    sub: 'Bảo mật tuyệt đối',
  },
  {
    icon: 'flash-outline' as const,
    title: 'Nhanh chóng',
    sub: 'Tiết kiệm thời gian',
  },
  {
    icon: 'heart-outline' as const,
    title: 'Tiện lợi',
    sub: 'Mọi thứ trong tầm tay',
  },
];

export function TrustFooter({
  tab,
  onSwitchTab,
  versionLabel,
}: {
  tab: AuthTab;
  onSwitchTab: (tab: AuthTab) => void;
  versionLabel: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.trustRow}>
        {TRUST.map((item) => (
          <View key={item.title} style={styles.trustItem}>
            <Ionicons name={item.icon} size={22} color={GOXE.tealDark} />
            <Text style={styles.trustTitle}>{item.title}</Text>
            <Text style={styles.trustSub}>{item.sub}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.hotline}>
        Vui lòng liên hệ hotline{' '}
        <Text style={styles.hotlineBold}>{GOXE.hotline}</Text> nếu bạn cần hỗ trợ.{' '}
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL(`tel:${GOXE.hotline}`)}
        >
          Gọi ngay
        </Text>
      </Text>

      {tab === 'login' ? (
        <Text style={styles.switchLine}>
          Bạn chưa có tài khoản?{' '}
          <Text style={styles.link} onPress={() => onSwitchTab('register')}>
            Đăng ký ngay
          </Text>
        </Text>
      ) : (
        <Text style={styles.switchLine}>
          Bạn đã có tài khoản?{' '}
          <Text style={styles.link} onPress={() => onSwitchTab('login')}>
            Đăng nhập ngay
          </Text>
        </Text>
      )}

      <Text style={styles.version}>{versionLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    gap: 14,
    paddingBottom: 8,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: GOXE.text,
    textAlign: 'center',
  },
  trustSub: {
    fontSize: 11,
    color: GOXE.textMuted,
    textAlign: 'center',
  },
  hotline: {
    fontSize: 12,
    color: GOXE.textSub,
    textAlign: 'center',
    lineHeight: 18,
  },
  hotlineBold: {
    fontWeight: '800',
    color: GOXE.text,
  },
  switchLine: {
    fontSize: 13,
    color: GOXE.textSub,
    textAlign: 'center',
  },
  link: {
    color: GOXE.tealDark,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    color: GOXE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
