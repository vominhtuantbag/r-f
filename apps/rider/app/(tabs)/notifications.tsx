import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { UnderlineTabs } from '../../src/components/ui/UnderlineTabs';
import { MOCK_NOTIFICATIONS } from '../../src/features/notifications/mock';
import { GOXE } from '../../src/theme/goxe';

type NotiTab = 'alerts' | 'messages';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<NotiTab>('alerts');
  const tabs = useMemo(
    () => [
      { key: 'alerts' as const, label: 'Thông báo' },
      { key: 'messages' as const, label: 'Tin nhắn' },
    ],
    [],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.screenTitle}>Thông báo</Text>
      <UnderlineTabs options={tabs} value={tab} onChange={setTab} />

      {tab === 'alerts' ? (
        <FlatList
          data={MOCK_NOTIFICATIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" title="Chưa có thông báo" />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.time}>{item.timestamp}</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.messagesWrap}>
          <View style={styles.messagesEmpty}>
            <Ionicons name="chatbubble-ellipses-outline" size={72} color="#C5CED0" />
            <Text style={styles.msgTitle}>Chưa có hội thoại đơn food</Text>
            <Text style={styles.msgSub}>
              Đặt món xong bạn có thể chat với quán / tài xế ngay tại đây.
            </Text>
          </View>

          <Pressable
            style={styles.supportCard}
            onPress={() => {
              void Linking.openURL(`tel:${GOXE.hotline}`);
              router.push('/support/chat');
            }}
          >
            <View style={styles.supportIcon}>
              <Ionicons name="headset" size={22} color={GOXE.peachIcon} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Cần hỗ trợ?</Text>
              <Text style={styles.supportSub}>Gọi hotline {GOXE.hotline}</Text>
            </View>
            <View style={styles.phoneBtn}>
              <Ionicons name="call" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOXE.bg },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: GOXE.text,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: GOXE.surface,
    borderRadius: 14,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#081E22',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(8,30,34,0.06)' } as object,
      default: {},
    }),
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: GOXE.text,
    lineHeight: 22,
  },
  cardBody: {
    marginTop: 6,
    fontSize: 13,
    color: GOXE.textSub,
    lineHeight: 20,
  },
  time: {
    marginTop: 10,
    fontSize: 12,
    color: GOXE.textMuted,
  },
  messagesWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  messagesEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  msgTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    color: GOXE.text,
    textAlign: 'center',
  },
  msgSub: {
    fontSize: 13,
    color: GOXE.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: GOXE.peach,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  supportIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFE8D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: { fontSize: 15, fontWeight: '800', color: GOXE.text },
  supportSub: { marginTop: 2, fontSize: 12, color: GOXE.textSub },
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOXE.peachIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
