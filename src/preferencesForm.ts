import type {
  FeaturedPreferencesBootstrapResponse,
  FeaturedUserDisplayPreferences,
  FeaturedUserPreferences
} from './types/featured';

type CurrentPreferences = FeaturedPreferencesBootstrapResponse['current'];
type PreferenceOptions = FeaturedPreferencesBootstrapResponse['options'];

export function serializePreferencesForm(
  dialog: HTMLFormElement,
  current: CurrentPreferences,
  options: PreferenceOptions
): FeaturedUserPreferences {
  const preferences: FeaturedUserPreferences = {
    sourceEnabled: {},
    sourceWeights: {},
    display: { ...current.preferences.display },
    preferredGenres: null,
    excludedGenres: null,
    unplayedBoost: null,
    favouriteBoost: null,
    inProgressSeriesBoost: null,
    repeatCooldownDays: null,
    repeatCooldownHours: null
  };
  dialog.querySelectorAll<HTMLElement>('[data-display-preference-key]').forEach((field) => {
    const key = field.dataset.displayPreferenceKey as keyof FeaturedUserDisplayPreferences;
    const checked = field.querySelector<HTMLInputElement>('input')!.checked;
    preferences.display[key] = checked === current.defaults.display[key] ? null : checked;
  });
  dialog.querySelectorAll<HTMLElement>('[data-source-id]').forEach((field) => {
    const id = field.dataset.sourceId!;
    const input = field.querySelector<HTMLInputElement>('input')!;
    if (input.type === 'checkbox') {
      if (input.checked !== current.defaults.sourceEnabled[id]) preferences.sourceEnabled[id] = input.checked;
    } else {
      const value = Number(input.value);
      if (value !== current.defaults.sourceWeights[id]) preferences.sourceWeights[id] = value;
    }
  });
  if (options.policy.allowPreferredGenres) {
    const genreFields = Array.from(dialog.querySelectorAll<HTMLElement>('[data-genre]'));
    const selectedGenres = genreFields
      .filter((field) => field.dataset.genreState === 'preferred')
      .map((field) => field.dataset.genre!);
    const excludedGenres = genreFields
      .filter((field) => field.dataset.genreState === 'excluded')
      .map((field) => field.dataset.genre!);
    const normalized = (values: string[]): string => [...values].sort((a, b) => a.localeCompare(b)).join('\n');
    preferences.preferredGenres =
      normalized(selectedGenres) === normalized(current.defaults.preferredGenres) ? null : selectedGenres;
    preferences.excludedGenres =
      normalized(excludedGenres) === normalized(current.defaults.excludedGenres) ? null : excludedGenres;
  }
  dialog.querySelectorAll<HTMLElement>('[data-preference-key]').forEach((field) => {
    const key = field.dataset.preferenceKey as 'unplayedBoost' | 'favouriteBoost' | 'inProgressSeriesBoost';
    const value = Number(field.querySelector<HTMLInputElement>('input')!.value);
    if (value !== current.defaults[key]) preferences[key] = value;
  });
  const cooldown = dialog.querySelector<HTMLSelectElement>('[data-cooldown-hours]');
  if (cooldown) {
    const value = Number(cooldown.value);
    if (value !== current.defaults.repeatCooldownHours) preferences.repeatCooldownHours = value;
  }
  return preferences;
}
