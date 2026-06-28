import { readFileSync } from 'node:fs';

export type FireflyDocument<T> = {
  data: T[];
};

export type FireflySingle<T> = {
  data: T;
};

export type FireflyResource = {
  id: string;
  attributes?: Record<string, unknown>;
};

export type FireflySplit = Record<string, unknown>;

export function fireflyToken() {
  if (process.env.FIREFLY_TOKEN?.trim()) {
    return process.env.FIREFLY_TOKEN.trim();
  }

  const tokenFile = process.env.FIREFLY_TOKEN_FILE;
  if (!tokenFile) {
    return null;
  }

  try {
    return readFileSync(tokenFile, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

export async function fireflyGet<T>(token: string, path: string, params?: Record<string, string>) {
  const response = await fireflyRequest(token, path, {
    method: 'GET',
    params,
  });

  return (await response.json()) as T;
}

export async function fireflyPut<T>(token: string, path: string, body: unknown) {
  const response = await fireflyRequest(token, path, {
    body,
    method: 'PUT',
  });

  return (await response.json()) as T;
}

export async function loadCollection(token: string, path: string, params: Record<string, string>) {
  const response = await fireflyGet<FireflyDocument<FireflyResource>>(token, path, params);
  return response.data ?? [];
}

async function fireflyRequest(
  token: string,
  path: string,
  options: {
    body?: unknown;
    method: 'GET' | 'PUT';
    params?: Record<string, string>;
  },
) {
  const url = new URL(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    method: options.method,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Firefly ${path} returned HTTP ${response.status}`);
  }

  return response;
}

function apiBase() {
  const base = (process.env.FIREFLY_BASE_URL || 'http://127.0.0.1:18080').replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}
