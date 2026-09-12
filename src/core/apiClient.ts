import type { JellyfinApiClient } from '../types/jellyfin';

export function getApiClient(): JellyfinApiClient | undefined {
  return window.ApiClient ?? window.apiClient;
}

interface JsonRequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const apiClient = getApiClient();
  const url = apiClient?.getUrl?.(path) ?? path;
  const method = options.method ?? 'GET';
  if (!url) throw new Error(`Could not resolve ${path}`);

  if (apiClient?.ajax) {
    return await Promise.resolve(apiClient.ajax({
      type: method,
      url,
      dataType: 'json',
      ...(options.body === undefined ? {} : {
        contentType: 'application/json',
        data: JSON.stringify(options.body)
      })
    })) as T;
  }

  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    ...(options.body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body)
    })
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return await response.json() as T;
}

export function getAccessToken(): string | undefined {
  const value = getApiClient()?.accessToken;
  return typeof value === 'function' ? value() : value;
}
