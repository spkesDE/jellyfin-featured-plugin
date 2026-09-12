export interface FeaturedItem {
  id: string;
  name: string;
  tagline?: string | null;
  official_rating?: string | null;
  hasLogo: boolean;
  imageType: 'Backdrop' | 'Primary';
  mediaType: string;
  localTrailerId?: string;
  overview?: string | null;
  critic_rating?: number;
  community_rating?: number;
  productionYear?: number;
  runtimeMinutes?: number;
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
}

export interface FeaturedDiagnostics {
  frontendInjection: boolean;
  frontendInjectionMethod: string;
  jellyfinVersion: string;
  pluginVersion: string;
  currentUser: string;
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
  eligible: number;
  allocated: number;
  duplicates: number;
  returned: number;
}

export interface FeaturedSearchItem {
  id: string;
  name: string;
  mediaType: string;
  productionYear?: number | null;
  imageType: 'Backdrop' | 'Primary';
}
