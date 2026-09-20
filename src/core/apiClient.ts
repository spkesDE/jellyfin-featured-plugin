import type { JellyfinApiClient } from '../types/jellyfin';

export function getApiClient(): JellyfinApiClient | undefined {
  return window.ApiClient ?? window.apiClient;
}

interface JsonRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const apiClient = getApiClient();
  const url = apiClient?.getUrl?.(path) ?? path;
  const method = options.method ?? 'GET';
  if (!url) throw new Error(`Could not resolve ${path}`);

  if (apiClient?.ajax) {
    try {
      return await Promise.resolve(apiClient.ajax({
        type: method,
        url,
        dataType: 'json',
        ...(options.body === undefined ? {} : {
          contentType: 'application/json',
          data: JSON.stringify(options.body)
        })
      })) as T;
    } catch (error) {
      throw await createRequestError(path, error);
    }
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

async function createRequestError(path: string, error: unknown): Promise<Error> {
  if (error instanceof Error) return error;
  if (!error || typeof error !== 'object') return new Error(String(error));

  const failed = error as {
    status?: unknown;
    statusText?: unknown;
    responseText?: unknown;
    text?: () => Promise<string>;
  };
  const status = typeof failed.status === 'number' ? failed.status : null;
  let body = typeof failed.responseText === 'string' ? failed.responseText : '';
  if (!body && typeof failed.text === 'function') {
    try {
      body = await failed.text();
    } catch {
      // The HTTP status still provides a useful error if the response body is unavailable.
    }
  }

  const detail = parseErrorDetail(body);
  const statusText = typeof failed.statusText === 'string' ? failed.statusText.trim() : '';
  const statusPart = status === null ? '' : ` HTTP ${status}`;
  const message = [statusText, detail].filter(Boolean).join(': ');
  return new Error(`${path} returned${statusPart}${message ? ` (${message})` : ''}`);
}

function parseErrorDetail(body: string): string {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; title?: unknown; message?: unknown };
    const detail = parsed.detail ?? parsed.title ?? parsed.message;
    if (typeof detail === 'string') return detail.slice(0, 300);
  } catch {
    // Plain-text and HTML errors are compacted below.
  }
  return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function getAccessToken(): string | undefined {
  const value = getApiClient()?.accessToken;
  return typeof value === 'function' ? value() : value;
}
