export interface FeaturedItem {
  id: string;
  name: string;
  tagline?: string | null;
  official_rating?: string | null;
  hasLogo: boolean;
  hasImage: boolean;
  isFavorite: boolean;
  isPlayed: boolean;
  dismissalOptions?: FeaturedDismissalOption[] | null;
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

export type FeaturedDismissalScope = 'title' | 'series' | 'franchise';

export interface FeaturedDismissalOption {
  scope: FeaturedDismissalScope;
  name: string;
}

export interface FeaturedDismissalEntry {
  id: string;
  scope: FeaturedDismissalScope;
  key: string;
  name: string;
  itemId: string;
  dismissedAt: string;
}

export interface FeaturedDismissalPolicy {
  enabled: boolean;
  showButton: boolean;
  allowTitle: boolean;
  allowSeries: boolean;
  allowFranchise: boolean;
}

export interface FeaturedDismissalsResponse {
  policy: FeaturedDismissalPolicy;
  entries: FeaturedDismissalEntry[];
}

export interface FeaturedDismissalMutationResponse {
  dismissal: FeaturedDismissalEntry;
}

export interface FeaturedTrailer {
  type: 'local' | 'remote' | 'trickplay';
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
  dismissalsEnabled: boolean;
  activePresetId?: string;
  activePresetName?: string;
  nextPresetChange?: string;
}

export interface FeaturedUserPreferences {
  sourceEnabled: Record<string, boolean>;
  sourceWeights: Record<string, number>;
  display: FeaturedUserDisplayPreferences;
  preferredGenres: string[] | null;
  excludedGenres: string[] | null;
  unplayedBoost: number | null;
  favouriteBoost: number | null;
  inProgressSeriesBoost: number | null;
  repeatCooldownDays: number | null;
  repeatCooldownHours: number | null;
}

export interface FeaturedUserDisplayPreferences {
  enableBackgroundTrailers: boolean | null;
  showRating: boolean | null;
  showDescription: boolean | null;
  showYear: boolean | null;
  showRuntime: boolean | null;
  showFavoriteButton: boolean | null;
  showPlaystateButton: boolean | null;
  showDismissalButton: boolean | null;
}

export interface FeaturedEffectivePreferences {
  sourceEnabled: Record<string, boolean>;
  sourceWeights: Record<string, number>;
  display: FeaturedEffectiveDisplayPreferences;
  preferredGenres: string[];
  excludedGenres: string[];
  unplayedBoost: number;
  favouriteBoost: number;
  inProgressSeriesBoost: number;
  repeatCooldownDays: number;
  repeatCooldownHours: number;
}

export interface FeaturedEffectiveDisplayPreferences {
  enableBackgroundTrailers: boolean;
  showRating: boolean;
  showDescription: boolean;
  showYear: boolean;
  showRuntime: boolean;
  showFavoriteButton: boolean;
  showPlaystateButton: boolean;
  showDismissalButton: boolean;
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

export interface FeaturedPreferencesBootstrapResponse {
  current: FeaturedPreferencesResponse;
  options: FeaturedPreferenceOptions;
  dismissals: FeaturedDismissalsResponse;
}

export interface FeaturedDiagnostics {
  frontendInjection: boolean;
  frontendInjectionMethod: string;
  frontendInjectionMethodsAvailable: Record<string, boolean>;
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
  repeatCooldownHours: number;
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
  dismissedExcluded: number;
  eligible: number;
  allocated: number;
  duplicates: number;
  diversitySkipped: number;
  cooldownRelaxed: number;
  fallback: boolean;
  returned: number;
}

export interface FeaturedFeedPreviewItem {
  id: string;
  name: string;
  mediaType: string;
  productionYear?: number | null;
  sourceId: string;
  sourceType: string;
}

export interface FeaturedFeedPreview {
  userId: string;
  userName: string;
  activePresetId?: string | null;
  activePresetName?: string | null;
  nextPresetChange?: string | null;
  items: FeaturedFeedPreviewItem[];
  rules: FeaturedRuleDiagnostics[];
  duplicatesRemoved: number;
  cooldownExcluded: number;
  dismissedExcluded: number;
  diversitySkipped: number;
  userProfileApplied: boolean;
}

export interface FeaturedSearchItem {
  id: string;
  name: string;
  mediaType: string;
  productionYear?: number | null;
  imageType: 'Backdrop' | 'Primary';
}
