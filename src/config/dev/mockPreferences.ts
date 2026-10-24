import type { FeaturedPluginConfig } from '../../types/config';
import type { FeaturedPreferencesBootstrapResponse, FeaturedUserPreferences } from '../../types/featured';

const saved = new Map<string, FeaturedUserPreferences>();

export function mockPreferences(
  config: FeaturedPluginConfig,
  url: string,
  method?: string,
  data?: string
): FeaturedPreferencesBootstrapResponse {
  const userId = new URL(url, window.location.href).searchParams.get('userId') ?? 'editor-1';
  if (method === 'PUT' && data) {
    const update = JSON.parse(data) as { reset?: boolean; preferences?: FeaturedUserPreferences };
    if (update.reset) saved.delete(userId);
    else if (update.preferences) saved.set(userId, update.preferences);
  }
  const preferences: FeaturedUserPreferences = saved.get(userId) ?? {
    sourceEnabled: {},
    sourceWeights: {},
    display: {
      enableBackgroundTrailers: null,
      showDescription: null,
      showRating: null,
      showYear: null,
      showRuntime: null,
      showFavoriteButton: null,
      showPlaystateButton: null,
      showDismissalButton: null
    },
    preferredGenres: null,
    excludedGenres: null,
    unplayedBoost: null,
    favouriteBoost: null,
    inProgressSeriesBoost: null,
    repeatCooldownDays: null,
    repeatCooldownHours: null
  };
  const sources = config.SourceRules.filter((rule) => !rule.UserIds.length || rule.UserIds.includes(userId));
  const policy = config.PersonalizationPolicy;
  const personalized = policy.Enabled ? preferences : null;
  const defaults = {
    sourceEnabled: Object.fromEntries(sources.map((rule) => [rule.Id, rule.Enabled])),
    sourceWeights: Object.fromEntries(sources.map((rule) => [rule.Id, rule.Weight])),
    display: {
      enableBackgroundTrailers: config.EnableBackgroundTrailers,
      showDescription: config.ShowDescription,
      showRating: config.ShowRating,
      showYear: config.ShowYear,
      showRuntime: config.ShowRuntime,
      showFavoriteButton: config.ShowFavoriteButton,
      showPlaystateButton: config.ShowPlaystateButton,
      showDismissalButton: config.DismissalPolicy.Enabled && config.ShowDismissalButton
    },
    preferredGenres: config.PersonalizationDefaults.PreferredGenres,
    excludedGenres: [],
    unplayedBoost: config.PersonalizationDefaults.UnplayedBoost,
    favouriteBoost: config.PersonalizationDefaults.FavouriteBoost,
    inProgressSeriesBoost: config.PersonalizationDefaults.InProgressSeriesBoost,
    repeatCooldownDays: config.RepeatCooldownDays,
    repeatCooldownHours: config.RepeatCooldownDays * 24
  };
  const effective = {
    ...defaults,
    sourceEnabled: { ...defaults.sourceEnabled, ...(policy.AllowSourceSelection ? personalized?.sourceEnabled : {}) },
    sourceWeights: { ...defaults.sourceWeights, ...(policy.AllowSourceWeights ? personalized?.sourceWeights : {}) },
    display: {
      enableBackgroundTrailers:
        defaults.display.enableBackgroundTrailers && personalized?.display.enableBackgroundTrailers !== false,
      showDescription: defaults.display.showDescription && personalized?.display.showDescription !== false,
      showRating: defaults.display.showRating && personalized?.display.showRating !== false,
      showYear: defaults.display.showYear && personalized?.display.showYear !== false,
      showRuntime: defaults.display.showRuntime && personalized?.display.showRuntime !== false,
      showFavoriteButton: defaults.display.showFavoriteButton && personalized?.display.showFavoriteButton !== false,
      showPlaystateButton: defaults.display.showPlaystateButton && personalized?.display.showPlaystateButton !== false,
      showDismissalButton: defaults.display.showDismissalButton && preferences.display.showDismissalButton !== false
    },
    preferredGenres: policy.AllowPreferredGenres
      ? (personalized?.preferredGenres ?? defaults.preferredGenres)
      : defaults.preferredGenres,
    excludedGenres: policy.AllowPreferredGenres ? (personalized?.excludedGenres ?? []) : [],
    unplayedBoost: policy.AllowUnplayedBoost
      ? (personalized?.unplayedBoost ?? defaults.unplayedBoost)
      : defaults.unplayedBoost,
    favouriteBoost: policy.AllowFavouriteBoost
      ? (personalized?.favouriteBoost ?? defaults.favouriteBoost)
      : defaults.favouriteBoost,
    inProgressSeriesBoost: policy.AllowInProgressSeriesBoost
      ? (personalized?.inProgressSeriesBoost ?? defaults.inProgressSeriesBoost)
      : defaults.inProgressSeriesBoost,
    repeatCooldownHours: policy.AllowRepeatCooldown
      ? (personalized?.repeatCooldownHours ?? defaults.repeatCooldownHours)
      : defaults.repeatCooldownHours
  };
  return {
    current: { hasOverrides: saved.has(userId), preferences, effective, defaults },
    options: {
      policy: {
        enabled: policy.Enabled,
        allowSourceSelection: policy.AllowSourceSelection,
        allowSourceWeights: policy.AllowSourceWeights,
        allowPreferredGenres: policy.AllowPreferredGenres,
        allowUnplayedBoost: policy.AllowUnplayedBoost,
        allowFavouriteBoost: policy.AllowFavouriteBoost,
        allowInProgressSeriesBoost: policy.AllowInProgressSeriesBoost,
        allowRepeatCooldown: policy.AllowRepeatCooldown
      },
      sources: sources.map((rule) => ({ id: rule.Id, type: rule.Type, enabled: rule.Enabled, weight: rule.Weight })),
      genres: ['Action', 'Comedy', 'Drama', 'Science Fiction']
    },
    dismissals: {
      policy: {
        enabled: config.DismissalPolicy.Enabled,
        showButton: config.ShowDismissalButton,
        allowTitle: config.DismissalPolicy.AllowTitle,
        allowSeries: config.DismissalPolicy.AllowSeries,
        allowFranchise: config.DismissalPolicy.AllowFranchise
      },
      entries: []
    }
  };
}
