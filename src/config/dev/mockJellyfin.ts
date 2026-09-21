import type { FeaturedPluginConfig } from '../../types/config';
import { cloneJsonValue } from '../../core/clone';
import { createDefaultConfig, createFeaturedResponseDefaults } from '../libs/defaults';

let config: FeaturedPluginConfig = createDefaultConfig();

export function installMockJellyfin(): void {
  window.ApiClient = {
    getCurrentUserId: () => 'editor-1',
    getPluginConfiguration: async () => cloneJsonValue(config),
    updatePluginConfiguration: async (_id, value) => { config = cloneJsonValue(value as FeaturedPluginConfig); return {}; },
    getUsers: async () => [
      { Id: 'editor-1', Name: 'Editorial Team', Policy: { IsDisabled: false } },
      { Id: 'editor-2', Name: 'Cinema Club', Policy: { IsDisabled: false } }
    ],
    getItems: async () => ({ Items: [
      { Id: 'movies', Name: 'Movies', CollectionType: 'movies' },
      { Id: 'shows', Name: 'TV Shows', CollectionType: 'tvshows' },
      { Id: 'music', Name: 'Music', CollectionType: 'music' },
      { Id: 'books', Name: 'Books', CollectionType: 'books' },
      { Id: 'home-videos', Name: 'Home Videos & Photos', CollectionType: 'homevideos' },
      { Id: 'boxsets', Name: 'Collections', CollectionType: 'boxsets' }
    ] }),
    getParentalRatings: async () => [
      { Name: 'PG', RatingScore: { score: 5, subScore: 0 } },
      { Name: 'PG-13', RatingScore: { score: 8, subScore: 0 } },
      { Name: 'R', RatingScore: { score: 10, subScore: 0 } }
    ],
    ajax: async ({ url }) => {
      if (url.includes('featured/config/search')) {
        return { items: [
          { id: 'movie-1', name: 'The Winter Archive', mediaType: 'Movie', imageType: 'Backdrop', productionYear: 2025 },
          { id: 'series-1', name: 'Northern Lights', mediaType: 'Series', imageType: 'Backdrop', productionYear: 2024 }
        ] };
      }
      if (url.includes('featured/items/displayed')) return { ok: true };
      if (url.includes('featured/config/history/clear')) return { ok: true, selectedUsers: 1, historiesRemoved: 1 };
      if (url.includes('Items/Filters')) {
        return {
          Genres: ['Action', 'Comedy', 'Drama', 'Science Fiction'],
          Tags: ['Christmas', 'Family', 'Featured', 'Weekend']
        };
      }
      if (url.includes('featured/config/options')) {
        return {
          collections: [{ id: 'collection-1', name: 'Awards Season' }, { id: 'collection-2', name: 'Weekend Picks' }],
          playlists: [{ id: 'playlist-1', name: 'Friday Night' }, { id: 'playlist-2', name: 'Family Picks' }],
          genres: ['Action', 'Comedy', 'Drama', 'Science Fiction'],
          tags: ['Christmas', 'Family', 'Featured', 'Weekend']
        };
      }
      if (url.includes('featured/diagnostics')) {
        return {
          frontendInjection: true,
          frontendInjectionMethod: 'file-transformation',
          jellyfinVersion: '12.0.0.0',
          pluginVersion: '12.1.0.0',
          currentUser: 'Administrator',
          sources: config.SourceRules.filter((rule) => rule.Enabled).map((rule) => rule.Type),
          matchingItems: 184,
          eligibleItems: 37,
          heroItemsReturned: 8,
          manualListsActive: config.ManualLists.filter((list) => list.Enabled && config.SourceRules.some((rule) =>
            rule.Enabled && rule.Type === 'MANUAL_LISTS' && rule.ManualListIds.includes(list.Id))).length,
          userProfileApplied: config.UserProfiles.some((profile) => profile.Enabled && profile.UserId === 'editor-1'),
          repeatCooldownDays: config.RepeatCooldownDays,
          repeatCooldownHours: config.RepeatCooldownDays * 24,
          historyEntries: 12,
          basePath: '/',
          cache: 'disabled',
          rules: []
        };
      }
      if (url.includes('featured/config/preview')) {
        return {
          userId: 'editor-1',
          userName: 'Editorial Team',
          activePresetId: null,
          activePresetName: null,
          nextPresetChange: null,
          items: [
            { id: 'preview-1', name: 'The Winter Archive', mediaType: 'Movie', productionYear: 2025, sourceId: 'default-random', sourceType: 'RANDOM' },
            { id: 'preview-2', name: 'Northern Lights', mediaType: 'Series', productionYear: 2024, sourceId: 'default-random', sourceType: 'RANDOM' },
            { id: 'preview-3', name: 'Friday Feature', mediaType: 'Movie', productionYear: 2026, sourceId: 'default-random', sourceType: 'RANDOM' },
            { id: 'preview-4', name: 'Beyond the Horizon', mediaType: 'Movie', productionYear: 2023, sourceId: 'default-random', sourceType: 'RANDOM' },
            { id: 'preview-5', name: 'Cinema Club', mediaType: 'Series', productionYear: 2025, sourceId: 'default-random', sourceType: 'RANDOM' }
          ],
          rules: [{
            id: 'default-random', type: 'RANDOM', candidateItems: 42, filteredOut: 4, afterFilters: 38,
            ineligible: 2, cooldownExcluded: 3, eligible: 33, allocated: 5, duplicates: 1,
            diversitySkipped: 2, cooldownRelaxed: 0, fallback: false, returned: 5
          }],
          duplicatesRemoved: 1,
          cooldownExcluded: 3,
          diversitySkipped: 2,
          userProfileApplied: true
        };
      }
      if (url.includes('featured/items')) {
        return {
          ...createFeaturedResponseDefaults(),
          items: [{
            id: 'preview-movie',
            name: 'A Beautifully Long Movie Title for the Preview',
            mediaType: 'Movie',
            imageType: 'Backdrop',
            hasLogo: false,
            isFavorite: false,
            isPlayed: false,
            overview: 'A real-library-style preview showing how the selected banner settings will look.',
            community_rating: 8.7,
            critic_rating: 92,
            productionYear: 2026,
            runtimeMinutes: 124
          }]
        };
      }
      if (url.includes('Items/Filters')) {
        return { Genres: ['Action', 'Comedy', 'Drama', 'Science Fiction'], Tags: ['Christmas', 'Family', 'Featured', 'Weekend'] };
      }
      if (url.includes('includeItemTypes=Playlist')) {
        return { Items: [{ Id: 'playlist-1', Name: 'Friday Night' }, { Id: 'playlist-2', Name: 'Family Picks' }] };
      }
      return url.includes('parentId=boxsets') ? {
        Items: [{ Id: 'collection-1', Name: 'Awards Season' }, { Id: 'collection-2', Name: 'Weekend Picks' }]
      } : { Items: [] };
    }
  };
  window.Dashboard = {
    showLoadingMsg: () => undefined,
    hideLoadingMsg: () => undefined,
    processPluginConfigurationUpdateResult: () => undefined
  };
}
