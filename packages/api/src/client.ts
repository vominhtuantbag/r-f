import { getEnv } from '@ridefood/config';
import type { ApiErrorBody, AuthTokens } from '@ridefood/types';
import { handleMockRequest } from './mock';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;
  readonly body: ApiErrorBody;

  constructor(body: ApiErrorBody, status = 500) {
    super(body.message || 'Request failed');
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code;
    this.errors = body.errors;
    this.body = body;
  }
}

export type TokenGetter = () => AuthTokens | null | Promise<AuthTokens | null>;
export type TokenSetter = (tokens: AuthTokens | null) => void | Promise<void>;
export type RefreshHandler = (refreshToken: string) => Promise<AuthTokens>;

export interface ApiClientOptions {
  baseUrl?: string;
  getTokens?: TokenGetter;
  setTokens?: TokenSetter;
  refreshTokens?: RefreshHandler;
  defaultHeaders?: Record<string, string>;
  locale?: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function normalizeError(payload: unknown, status: number): ApiClientError {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const message =
      (typeof p.message === 'string' && p.message) ||
      (typeof p.error === 'string' && p.error) ||
      `HTTP ${status}`;
    return new ApiClientError(
      {
        message,
        code: typeof p.code === 'string' ? p.code : undefined,
        errors:
          p.errors && typeof p.errors === 'object'
            ? (p.errors as Record<string, string[]>)
            : undefined,
        status,
      },
      status,
    );
  }
  return new ApiClientError({ message: `HTTP ${status}`, status }, status);
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getTokens: TokenGetter;
  private readonly setTokens: TokenSetter;
  private readonly refreshTokens?: RefreshHandler;
  private readonly defaultHeaders: Record<string, string>;
  private locale: string;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(options: ApiClientOptions = {}) {
    const env = getEnv();
    this.baseUrl = (options.baseUrl ?? env.apiBaseUrl).replace(/\/$/, '');
    this.getTokens = options.getTokens ?? (() => null);
    this.setTokens = options.setTokens ?? (() => undefined);
    this.refreshTokens = options.refreshTokens;
    this.defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.defaultHeaders,
    };
    this.locale = options.locale ?? env.defaultLocale;
  }

  setLocale(locale: string): void {
    this.locale = locale;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? (options.body ? 'POST' : 'GET');
    const env = getEnv();

    // Local mock / offline mode — no network backend required
    if (env.isMockMode || this.baseUrl.startsWith('mock://')) {
      return handleMockRequest<T>({
        method,
        path: options.path,
        body: options.body,
        query: options.query,
      });
    }

    const url = `${this.baseUrl}${options.path}${buildQuery(options.query)}`;
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      'Accept-Language': this.locale,
      ...options.headers,
    };

    const useAuth = options.auth !== false;
    if (useAuth) {
      const tokens = await this.getTokens();
      if (tokens?.accessToken) {
        headers.Authorization = `${tokens.tokenType} ${tokens.accessToken}`;
      }
    }

    const init: RequestInit = {
      method,
      headers,
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    };

    let res = await fetch(url, init);

    if (res.status === 401 && useAuth && this.refreshTokens) {
      const rotated = await this.tryRefresh();
      if (rotated) {
        headers.Authorization = `${rotated.tokenType} ${rotated.accessToken}`;
        res = await fetch(url, { ...init, headers });
      }
    }

    const payload = await parseBody(res);

    if (!res.ok) {
      throw normalizeError(payload, res.status);
    }

    return payload as T;
  }

  get<T>(path: string, query?: RequestOptions['query'], auth = true): Promise<T> {
    return this.request<T>({ method: 'GET', path, query, auth });
  }

  post<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, auth });
  }

  put<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, auth });
  }

  patch<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body, auth });
  }

  delete<T>(path: string, auth = true): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, auth });
  }

  private async tryRefresh(): Promise<AuthTokens | null> {
    if (!this.refreshTokens) return null;
    const current = await this.getTokens();
    if (!current?.refreshToken) return null;

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshTokens(current.refreshToken)
        .then(async (tokens) => {
          await this.setTokens(tokens);
          return tokens;
        })
        .catch(async (err) => {
          await this.setTokens(null);
          throw err;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    try {
      return await this.refreshPromise;
    } catch {
      return null;
    }
  }
}

export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
