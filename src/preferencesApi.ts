import { getApiClient, requestJson } from './core/apiClient';
import type { FeaturedPreferencesBootstrapResponse } from './types/featured';

const BOOTSTRAP_CACHE_LIFETIME_MS = 5 * 60_000;
let cachedBootstrap: { userId: string; value: FeaturedPreferencesBootstrapResponse; expiresAt: number } | null = null;
let pendingBootstrap: { userId: string; promise: Promise<FeaturedPreferencesBootstrapResponse> } | null = null;

export function loadPreferencesBootstrap(): Promise<FeaturedPreferencesBootstrapResponse> {
  const userId = getApiClient()?.getCurrentUserId?.() ?? '';
  if (cachedBootstrap?.userId === userId && cachedBootstrap.expiresAt > Date.now()) {
    return Promise.resolve(cachedBootstrap.value);
  }
  if (pendingBootstrap?.userId === userId) return pendingBootstrap.promise;

  const promise = requestJson<FeaturedPreferencesBootstrapResponse>('featured/preferences/bootstrap')
    .then((value) => {
      cachedBootstrap = { userId, value, expiresAt: Date.now() + BOOTSTRAP_CACHE_LIFETIME_MS };
      return value;
    })
    .finally(() => {
      if (pendingBootstrap?.promise === promise) pendingBootstrap = null;
    });
  pendingBootstrap = { userId, promise };
  return promise;
}

export function preloadPreferencesDialog(): void {
  void loadPreferencesBootstrap().catch(() => undefined);
}

export function invalidatePreferencesBootstrap(): void {
  cachedBootstrap = null;
}
