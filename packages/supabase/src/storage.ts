/**
 * Cross-platform Supabase auth storage for Expo (Web / iOS / Android).
 * - Web: `localStorage`
 * - Native: `expo-secure-store` when possible, else AsyncStorage
 * - Mock / SSR: in-memory Map
 *
 * Never stores `service_role` keys — only the anon session blob from supabase-js.
 */

export interface AuthStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const memory = new Map<string, string>();

function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function getSecureStore(): Promise<{
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
} | null> {
  if (isWebRuntime()) return null;
  try {
    // Optional Expo peer — present in rider/driver/partner apps.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store') as {
      getItemAsync: (key: string) => Promise<string | null>;
      setItemAsync: (key: string, value: string) => Promise<void>;
      deleteItemAsync: (key: string) => Promise<void>;
    };
  } catch {
    return null;
  }
}

async function getAsyncStorage(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as {
      default: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
        removeItem: (key: string) => Promise<void>;
      };
    };
    return mod.default;
  } catch {
    return null;
  }
}

/** In-memory adapter used for mock mode and non-browser SSR. */
export function createMemoryAuthStorage(): AuthStorageAdapter {
  return {
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => {
      memory.set(key, value);
    },
    removeItem: async (key) => {
      memory.delete(key);
    },
  };
}

/**
 * Persistent Expo auth storage. Prefer SecureStore on native; fall back to
 * AsyncStorage when the session JSON exceeds SecureStore size limits.
 */
export function createExpoAuthStorage(): AuthStorageAdapter {
  return {
    async getItem(key) {
      if (isWebRuntime()) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return memory.get(key) ?? null;
        }
      }
      const secure = await getSecureStore();
      if (secure) {
        try {
          const fromSecure = await secure.getItemAsync(key);
          if (fromSecure != null) return fromSecure;
        } catch {
          // fall through
        }
      }
      const asyncStorage = await getAsyncStorage();
      if (asyncStorage) return asyncStorage.getItem(key);
      return memory.get(key) ?? null;
    },

    async setItem(key, value) {
      if (isWebRuntime()) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch {
          memory.set(key, value);
          return;
        }
      }
      const secure = await getSecureStore();
      if (secure) {
        try {
          await secure.setItemAsync(key, value);
          return;
        } catch {
          // SecureStore ~2KB limit — mirror into AsyncStorage
        }
      }
      const asyncStorage = await getAsyncStorage();
      if (asyncStorage) {
        await asyncStorage.setItem(key, value);
        return;
      }
      memory.set(key, value);
    },

    async removeItem(key) {
      if (isWebRuntime()) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          memory.delete(key);
        }
        return;
      }
      const secure = await getSecureStore();
      if (secure) {
        try {
          await secure.deleteItemAsync(key);
        } catch {
          // ignore
        }
      }
      const asyncStorage = await getAsyncStorage();
      if (asyncStorage) await asyncStorage.removeItem(key);
      memory.delete(key);
    },
  };
}
