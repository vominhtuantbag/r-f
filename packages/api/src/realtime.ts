import { getEnv, type RealtimeDriver } from '@ridefood/config';
import type {
  RealtimeChannel,
  RealtimeEnvelope,
  RealtimeEventName,
} from '@ridefood/types';

export type RealtimeHandler<T = unknown> = (envelope: RealtimeEnvelope<T>) => void;

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface RealtimeClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: <T = unknown>(
    channel: RealtimeChannel,
    event: RealtimeEventName | '*',
    handler: RealtimeHandler<T>,
  ) => RealtimeSubscription;
  isConnected: () => boolean;
}

export interface RealtimeOptions {
  driver?: RealtimeDriver;
  authTokenGetter?: () => string | null | Promise<string | null>;
  pollingIntervalMs?: number;
  poll?: (channel: RealtimeChannel) => Promise<RealtimeEnvelope[]>;
  onConnectionChange?: (connected: boolean) => void;
}

type ListenerKey = string;

function listenerKey(channel: RealtimeChannel, event: RealtimeEventName | '*'): ListenerKey {
  return `${channel}::${event}`;
}

/** Polling fallback — works everywhere (Web/Android/iOS) without native WS deps. */
class PollingRealtimeClient implements RealtimeClient {
  private timers = new Map<RealtimeChannel, ReturnType<typeof setInterval>>();
  private listeners = new Map<ListenerKey, Set<RealtimeHandler>>();
  private connected = false;
  private readonly intervalMs: number;
  private readonly poll?: RealtimeOptions['poll'];
  private readonly onConnectionChange?: RealtimeOptions['onConnectionChange'];

  constructor(options: RealtimeOptions) {
    this.intervalMs = options.pollingIntervalMs ?? 4000;
    this.poll = options.poll;
    this.onConnectionChange = options.onConnectionChange;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.onConnectionChange?.(true);
  }

  disconnect(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    this.listeners.clear();
    this.connected = false;
    this.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe<T>(
    channel: RealtimeChannel,
    event: RealtimeEventName | '*',
    handler: RealtimeHandler<T>,
  ): RealtimeSubscription {
    const key = listenerKey(channel, event);
    const set = this.listeners.get(key) ?? new Set();
    set.add(handler as RealtimeHandler);
    this.listeners.set(key, set);
    this.ensurePolling(channel);

    return {
      unsubscribe: () => {
        const current = this.listeners.get(key);
        current?.delete(handler as RealtimeHandler);
        if (current && current.size === 0) this.listeners.delete(key);
        this.maybeStopPolling(channel);
      },
    };
  }

  private ensurePolling(channel: RealtimeChannel): void {
    if (!this.poll || this.timers.has(channel)) return;
    const timer = setInterval(() => {
      void this.tick(channel);
    }, this.intervalMs);
    this.timers.set(channel, timer);
    void this.tick(channel);
  }

  private maybeStopPolling(channel: RealtimeChannel): void {
    const stillNeeded = [...this.listeners.keys()].some((k) => k.startsWith(`${channel}::`));
    if (stillNeeded) return;
    const timer = this.timers.get(channel);
    if (timer) clearInterval(timer);
    this.timers.delete(channel);
  }

  private async tick(channel: RealtimeChannel): Promise<void> {
    if (!this.poll) return;
    try {
      const envelopes = await this.poll(channel);
      for (const envelope of envelopes) {
        this.dispatch(envelope);
      }
    } catch {
      // swallow transient poll errors; next tick retries
    }
  }

  private dispatch(envelope: RealtimeEnvelope): void {
    const exact = this.listeners.get(listenerKey(envelope.channel, envelope.event));
    const wildcard = this.listeners.get(listenerKey(envelope.channel, '*'));
    exact?.forEach((h) => h(envelope));
    wildcard?.forEach((h) => h(envelope));
  }
}

/**
 * Pusher/Reverb-shaped client. Uses global `Pusher` if present (web CDN / native bridge),
 * otherwise transparently falls back to polling.
 */
class PusherRealtimeClient implements RealtimeClient {
  private readonly fallback: PollingRealtimeClient;
  private readonly options: RealtimeOptions;
  private pusher: {
    connect: () => void;
    disconnect: () => void;
    subscribe: (channel: string) => {
      bind: (event: string, cb: (data: unknown) => void) => void;
      unbind: (event?: string) => void;
      unsubscribe?: () => void;
    };
    connection?: { state: string };
  } | null = null;
  private channelHandles = new Map<
    string,
    {
      channel: ReturnType<NonNullable<PusherRealtimeClient['pusher']>['subscribe']>;
      binds: Array<{ event: string; cb: (data: unknown) => void }>;
    }
  >();

  constructor(options: RealtimeOptions) {
    this.options = options;
    this.fallback = new PollingRealtimeClient(options);
  }

  async connect(): Promise<void> {
    const env = getEnv();
    const PusherGlobal = (globalThis as { Pusher?: new (key: string, opts: object) => unknown })
      .Pusher;

    if (!PusherGlobal || !env.pusherKey) {
      await this.fallback.connect();
      return;
    }

    const token = (await this.options.authTokenGetter?.()) ?? null;
    this.pusher = new PusherGlobal(env.pusherKey, {
      cluster: env.pusherCluster,
      authEndpoint: `${env.apiBaseUrl}/broadcasting/auth`,
      auth: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      wsHost: undefined,
      wsPort: undefined,
      forceTLS: env.wsBaseUrl.startsWith('wss'),
      enabledTransports: ['ws', 'wss'],
    }) as PusherRealtimeClient['pusher'];

    this.pusher?.connect();
    this.options.onConnectionChange?.(true);
  }

  disconnect(): void {
    for (const handle of this.channelHandles.values()) {
      handle.channel.unbind();
      handle.channel.unsubscribe?.();
    }
    this.channelHandles.clear();
    this.pusher?.disconnect();
    this.pusher = null;
    this.fallback.disconnect();
    this.options.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    if (this.pusher) {
      return this.pusher.connection?.state === 'connected' || true;
    }
    return this.fallback.isConnected();
  }

  subscribe<T>(
    channel: RealtimeChannel,
    event: RealtimeEventName | '*',
    handler: RealtimeHandler<T>,
  ): RealtimeSubscription {
    if (!this.pusher) {
      return this.fallback.subscribe(channel, event, handler);
    }

    let handle = this.channelHandles.get(channel);
    if (!handle) {
      handle = { channel: this.pusher.subscribe(channel), binds: [] };
      this.channelHandles.set(channel, handle);
    }

    const cb = (data: unknown) => {
      const envelope: RealtimeEnvelope<T> = {
        event: event === '*' ? ((data as { event?: RealtimeEventName })?.event ?? 'ride.status_changed') : event,
        channel,
        data: (data as { data?: T })?.data ?? (data as T),
        occurredAt: new Date().toISOString(),
      };
      handler(envelope);
    };

    const bindEvent = event === '*' ? 'pusher:subscription_succeeded' : event;
    // For '*', bind a catch-all via channel bind_global if available; else poll fallback for that channel.
    if (event === '*') {
      return this.fallback.subscribe(channel, event, handler);
    }

    handle.channel.bind(bindEvent, cb);
    handle.binds.push({ event: bindEvent, cb });

    return {
      unsubscribe: () => {
        handle?.channel.unbind(bindEvent);
        handle!.binds = handle!.binds.filter((b) => b.cb !== cb);
      },
    };
  }
}

export function createRealtimeClient(options: RealtimeOptions = {}): RealtimeClient {
  const env = getEnv();
  const driver = options.driver ?? env.realtimeDriver;

  // Prefer `@ridefood/supabase` realtime in new code. Legacy polling for transitional apps.
  if (driver === 'polling' || driver === 'supabase') {
    return new PollingRealtimeClient(options);
  }

  return new PusherRealtimeClient(options);
}
