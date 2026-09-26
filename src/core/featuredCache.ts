import { PLUGIN_VERSION } from '../constants';
import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { getApiClient, getCurrentUserId } from './apiClient';

const CACHE_SCHEMA_VERSION = 1;
const CACHE_STORAGE_PREFIX = 'jellyfin-featured.items.v1';
const CACHE_ITEM_LIMIT = 5;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface FeaturedCacheEntry {
  schemaVersion: number;
  pluginVersion: string;
  storedAt: number;
  expiresAt: number;
  response: FeaturedResponse;
}

export function getFeaturedCacheScope(): string | null {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const serverId = getApiClient()?.serverId?.() || window.location.origin;
  return `${encodeURIComponent(serverId)}.${encodeURIComponent(userId)}`;
}

function getStorageKey(): string | null {
  const scope = getFeaturedCacheScope();
  return scope ? `${CACHE_STORAGE_PREFIX}.${scope}` : null;
}

function getExpiry(response: FeaturedResponse, storedAt: number): number {
  const maximumExpiry = storedAt + CACHE_MAX_AGE_MS;
  if (!response.nextPresetChange) return maximumExpiry;
  const presetBoundary = new Date(response.nextPresetChange).getTime();
  return Number.isFinite(presetBoundary) ? Math.min(maximumExpiry, presetBoundary) : maximumExpiry;
}

export function readFeaturedCache(): FeaturedResponse | null {
  const key = getStorageKey();
  if (!key) return null;
  try {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) return null;
    const entry = JSON.parse(serialized) as Partial<FeaturedCacheEntry>;
    const valid = entry.schemaVersion === CACHE_SCHEMA_VERSION
      && entry.pluginVersion === PLUGIN_VERSION
      && typeof entry.storedAt === 'number'
      && typeof entry.expiresAt === 'number'
      && entry.expiresAt > Date.now()
      && entry.response !== null
      && typeof entry.response === 'object'
      && Array.isArray(entry.response.items)
      && entry.response.items.length > 0;
    if (valid) return entry.response as FeaturedResponse;
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable or contain a partially written value.
  }
  return null;
}

export function saveFeaturedCache(response: FeaturedResponse): void {
  const key = getStorageKey();
  if (!key || !response.items?.length) return;
  const storedAt = Date.now();
  const entry: FeaturedCacheEntry = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    storedAt,
    expiresAt: getExpiry(response, storedAt),
    response: { ...response, items: response.items.slice(0, CACHE_ITEM_LIMIT) }
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota and privacy restrictions must not prevent the carousel from loading.
  }
}

export function clearFeaturedCache(): void {
  const key = getStorageKey();
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}

export function keepCurrentItem(response: FeaturedResponse, currentItem?: FeaturedItem): FeaturedResponse {
  if (!currentItem || !response.items.length) return response;
  const freshCurrentItem = response.items.find((item) => item.id === currentItem.id) ?? currentItem;
  const items = [freshCurrentItem, ...response.items.filter((item) => item.id !== currentItem.id)]
    .slice(0, response.items.length);
  return { ...response, items };
}
