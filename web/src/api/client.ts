import { announceUnauthorized, clearToken, readToken } from '../auth/token.ts';
import type { ApiEnvelope, ApiErrorBody } from './types.ts';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (query === undefined) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised.length > 0 ? `${url}?${serialised}` : url;
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiError(response.status, 'UNKNOWN', response.statusText || 'Request failed');
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = { accept: 'application/json' };

  if (token !== null) {
    headers['authorization'] = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  if (response.status === 401) {
    clearToken();
    announceUnauthorized();
    throw await readError(response);
  }

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}
