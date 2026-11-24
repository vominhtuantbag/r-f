import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { SupportTicket, SupportTicketMessage } from '@ridefood/types';
import { useApi, useAuth, useTheme } from '../../src/providers/AppProviders';
import { t } from '../../src/lib/i18n';

export default function SupportChatScreen() {
  const theme = useTheme();
  const { api, realtime } = useApi();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportTicketMessage>>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api.support.tickets({ page: 1, status: 'open' });
        let active = list.data[0] ?? null;
        if (!active) {
          const created = await api.support.create({
            subject: 'Rider support',
            body: 'Hi, I need help with my recent trip or order.',
            priority: 'normal',
          });
          active = created.data;
        } else {
          const full = await api.support.get(active.id);
          active = full.data;
        }
        if (!alive) return;
        setTicket(active);
        setMessages(active.messages ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.error'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api.support]);

  useEffect(() => {
    if (!ticket) return;
    const sub = realtime.subscribe(
      `private-support.${ticket.id}`,
      'support.message',
      (env) => {
        const payload = env.data as { message: SupportTicketMessage };
        setMessages((prev) =>
          prev.some((m) => m.id === payload.message.id)
            ? prev
            : [...prev, payload.message],
        );
      },
    );
    const statusSub = realtime.subscribe(
      `private-support.${ticket.id}`,
      'support.ticket_updated',
      (env) => {
        const payload = env.data as { ticket: SupportTicket };
        setTicket(payload.ticket);
      },
    );
    return () => {
      sub.unsubscribe();
      statusSub.unsubscribe();
    };
  }, [realtime, ticket]);

  const send = async () => {
    if (!ticket || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.support.message(ticket.id, { body: body.trim() });
      setMessages((prev) => [...prev, res.data]);
      setBody('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {ticket ? (
        <View style={styles.header}>
          <Text style={styles.code}>{ticket.code}</Text>
          <Text style={styles.status}>
            {ticket.status}
            {ticket.refundStatus !== 'none' ? ` · refund ${ticket.refundStatus}` : ''}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.chip}
              onPress={async () => {
                const res = await api.support.escalate(ticket.id);
                setTicket(res.data);
              }}
            >
              <Text style={styles.chipLabel}>{t('support.escalate')}</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={async () => {
                const res = await api.support.requestRefund(ticket.id);
                setTicket(res.data);
              }}
            >
              <Text style={styles.chipLabel}>{t('support.refund')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>Start the conversation…</Text>}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, mine && styles.mineText]}>{item.body}</Text>
              <Text style={[styles.time, mine && styles.mineText]}>
                {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Message support…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
        />
        <Pressable style={styles.send} onPress={() => void send()} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.sendLabel}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: 4,
    },
    code: { fontWeight: '700', color: theme.colors.text },
    status: { color: theme.colors.textMuted, textTransform: 'capitalize' },
    headerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipLabel: { color: theme.colors.primary, fontWeight: '600', fontSize: 12 },
    list: { padding: theme.spacing.md, gap: theme.spacing.sm },
    empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
    bubble: {
      maxWidth: '82%',
      borderRadius: theme.radii.lg,
      padding: theme.spacing.sm + 4,
      marginBottom: theme.spacing.sm,
    },
    mine: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.primary,
    },
    theirs: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bubbleText: { color: theme.colors.text },
    mineText: { color: theme.colors.textInverse },
    time: {
      marginTop: 4,
      fontSize: 10,
      color: theme.colors.textMuted,
      alignSelf: 'flex-end',
    },
    composer: {
      flexDirection: 'row',
      gap: 8,
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'flex-end',
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.text,
    },
    send: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sendLabel: { color: theme.colors.textInverse, fontWeight: '700' },
    error: { color: theme.colors.danger, paddingHorizontal: theme.spacing.md },
  });
}
