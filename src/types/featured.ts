export interface FeaturedItem {
  id: string;
  name: string;
  tagline?: string | null;
  official_rating?: string | null;
  hasLogo: boolean;
  imageType: 'Backdrop' | 'Primary';
  mediaType: string;
  trailer?: FeaturedTrailer | null;
  trailers?: FeaturedTrailer[] | null;
  overview?: string | null;
  critic_rating?: number;
  community_rating?: number;
  productionYear?: number;
  runtimeMinutes?: number;
}

export interface FeaturedTrailer {
  type: 'local' | 'remote';
  provider: 'jellyfin' | 'youtube' | 'direct' | 'external' | string;
  name?: string | null;
  url?: string | null;
  videoId?: string | null;
  itemId?: string | null;
}

import type { FeaturedDisplaySettings } from './display';

export interface FeaturedResponse extends FeaturedDisplaySettings {
  items: FeaturedItem[];
  infiniteLoading: boolean;
  batchSize: number;
  hasMore: boolean;
  autoplay: boolean;
  autoplayInterval: number;
  reduceImageSizes: boolean;
  trackDisplayedItems: boolean;
  personalizationEnabled: boolean;
  activePresetId?: string;
  activePresetName?: string;
  nextPresetChange?: string;
}

export interface FeaturedUserPreferences {
  sourceEnabled: Record<string, boolean>;
  sourceWeights: Record<string, number>;
  preferredGenres: string[] | null;
  excludedGenres: string[] | null;
  unplayedBoost: number | null;
  favouriteBoost: number | null;
  inProgressSeriesBoost: number | null;
  repeatCooldownDays: number | null;
}

export interface FeaturedEffectivePreferences {
  sourceEnabled: Record<string, boolean>;
  sourceWeights: Record<string, number>;
  preferredGenres: string[];
  excludedGenres: string[];
  unplayedBoost: number;
  favouriteBoost: number;
  inProgressSeriesBoost: number;
  repeatCooldownDays: number;
}

export interface FeaturedPreferencesResponse {
  hasOverrides: boolean;
  preferences: FeaturedUserPreferences;
  effective: FeaturedEffectivePreferences;
  defaults: FeaturedEffectivePreferences;
}

export interface FeaturedPreferencePolicy {
  enabled: boolean;
  allowSourceSelection: boolean;
  allowSourceWeights: boolean;
  allowPreferredGenres: boolean;
  allowUnplayedBoost: boolean;
  allowFavouriteBoost: boolean;
  allowInProgressSeriesBoost: boolean;
  allowRepeatCooldown: boolean;
}

export interface FeaturedPreferenceOptions {
  policy: FeaturedPreferencePolicy;
  sources: Array<{ id: string; type: string; enabled: boolean; weight: number }>;
  genres: string[];
}

export interface FeaturedDiagnostics {
  frontendInjection: boolean;
  frontendInjectionMethod: string;
  jellyfinVersion: string;
  pluginVersion: string;
  currentUser: string;
  activePresetId: string;
  activePresetName: string;
  nextPresetChange: string;
  sources: string[];
  matchingItems: number;
  eligibleItems: number;
  heroItemsReturned: number;
  manualListsActive: number;
  userProfileApplied: boolean;
  repeatCooldownDays: number;
  historyEntries: number;
  basePath: string;
  cache: string;
  rules: FeaturedRuleDiagnostics[];
}

export interface FeaturedRuleDiagnostics {
  id: string;
  type: string;
  candidateItems: number;
  filteredOut: number;
  afterFilters: number;
  ineligible: number;
  cooldownExcluded: number;
  eligible: number;
  allocated: number;
  duplicates: number;
  diversitySkipped: number;
  cooldownRelaxed: number;
  fallback: boolean;
  returned: number;
}

export interface FeaturedSearchItem {
  id: string;
  name: string;
  mediaType: string;
  productionYear?: number | null;
  imageType: 'Backdrop' | 'Primary';
}
