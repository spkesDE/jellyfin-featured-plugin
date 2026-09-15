import { requestJson } from './core/apiClient';
import { replaceElementChildren } from './core/dom';
import { t, type TranslationKey } from './i18n';
import type { FeaturedEffectiveDisplayPreferences, FeaturedPreferencesBootstrapResponse, FeaturedUserDisplayPreferences, FeaturedUserPreferences } from './types/featured';
import { USER_PREFERENCES_CHANGED_EVENT } from './constants';

const bootstrapCacheLifetime = 30_000;
let bootstrapCache: { value: FeaturedPreferencesBootstrapResponse; expiresAt: number } | null = null;
let bootstrapRequest: Promise<FeaturedPreferencesBootstrapResponse> | null = null;

const sourceKeys: Record<string, TranslationKey> = {
  LIBRARIES: 'source.type.libraries', COLLECTIONS: 'source.type.collections', FAVOURITES: 'source.type.favourites',
  TAGS: 'source.type.tags', PLAYLISTS: 'source.type.playlists', RECENTLY_ADDED: 'source.type.recently_added',
  LATEST_RELEASES: 'source.type.latest_releases', RANDOM: 'source.type.random', UNPLAYED: 'source.type.unplayed',
  MANUAL_LISTS: 'source.type.manual_lists'
};

function loadPreferencesBootstrap(): Promise<FeaturedPreferencesBootstrapResponse> {
  if (bootstrapCache && bootstrapCache.expiresAt > Date.now()) return Promise.resolve(bootstrapCache.value);
  if (bootstrapRequest) return bootstrapRequest;
  bootstrapRequest = requestJson<FeaturedPreferencesBootstrapResponse>('featured/preferences/bootstrap')
    .then((value) => {
      bootstrapCache = { value, expiresAt: Date.now() + bootstrapCacheLifetime };
      return value;
    })
    .finally(() => { bootstrapRequest = null; });
  return bootstrapRequest;
}

function invalidatePreferencesBootstrap(): void {
  bootstrapCache = null;
}

function notifyPreferencesChanged(): void {
  document.dispatchEvent(new CustomEvent(USER_PREFERENCES_CHANGED_EVENT));
}

function checkbox(label: string, checked: boolean, disabled: boolean): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'emby-checkbox-label ec-preference-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'emby-checkbox';
  input.checked = checked;
  input.disabled = disabled;
  const text = document.createElement('span');
  text.className = 'checkboxLabel';
  text.textContent = label;
  const outline = document.createElement('span');
  outline.className = 'checkboxOutline';
  outline.innerHTML = '<span class="material-icons checkboxIcon checkboxIcon-checked check"></span><span class="material-icons checkboxIcon checkboxIcon-unchecked"></span>';
  wrapper.append(input, text, outline);
  return wrapper;
}

function numberField(label: string, value: number, max: number): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'inputContainer ec-preference-number';
  const text = document.createElement('span');
  text.className = 'inputLabel';
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'emby-input';
  input.min = '0';
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  wrapper.append(text, input);
  return wrapper;
}

const cooldownChoices: Array<[number, TranslationKey]> = [
  [0, 'preferences.cooldown.off'],
  [1, 'preferences.cooldown.1h'],
  [6, 'preferences.cooldown.6h'],
  [12, 'preferences.cooldown.12h'],
  [24, 'preferences.cooldown.24h'],
  [72, 'preferences.cooldown.3d'],
  [168, 'preferences.cooldown.7d'],
  [336, 'preferences.cooldown.14d'],
  [720, 'preferences.cooldown.30d']
];

function cooldownField(value: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'selectContainer ec-preference-cooldown';
  const fieldId = 'ec-preference-cooldown-hours';
  const label = document.createElement('label');
  label.className = 'selectLabel';
  label.htmlFor = fieldId;
  label.textContent = t('preferences.cooldown');
  const select = document.createElement('select');
  select.id = fieldId;
  select.className = 'emby-select emby-select-withcolor';
  select.dataset.cooldownHours = 'true';
  const values = new Set(cooldownChoices.map(([hours]) => hours));
  if (!values.has(value)) select.add(new Option(t('preferences.cooldown.custom', { hours: value }), String(value)));
  for (const [hours, key] of cooldownChoices) select.add(new Option(t(key), String(hours)));
  select.value = String(value);
  const arrow = document.createElement('div');
  arrow.className = 'selectArrowContainer';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<span class="selectArrow material-icons keyboard_arrow_down"></span>';
  wrapper.append(label, select, arrow);
  return wrapper;
}

type GenrePreferenceState = 'neutral' | 'preferred' | 'excluded';

function genreSelector(genre: string, initialState: GenrePreferenceState): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ec-preference-genre';
  button.dataset.genre = genre;
  const marker = document.createElement('span');
  marker.className = 'ec-preference-genre-marker';
  marker.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = genre;
  button.append(marker, label);

  const setState = (state: GenrePreferenceState): void => {
    button.dataset.genreState = state;
    marker.textContent = state === 'preferred' ? '✓' : state === 'excluded' ? '×' : '';
    button.setAttribute('aria-label', `${genre}: ${t(`preferences.genre.${state}`)}`);
  };
  setState(initialState);
  button.addEventListener('click', () => {
    const state = button.dataset.genreState as GenrePreferenceState;
    setState(state === 'neutral' ? 'preferred' : state === 'preferred' ? 'excluded' : 'neutral');
  });
  return button;
}

export async function openPreferencesDialog(): Promise<void> {
  if (document.querySelector('.ec-preferences-backdrop')) return;
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement('div');
  backdrop.className = 'ec-preferences-backdrop';
  backdrop.innerHTML = `<section class="ec-preferences-dialog ec-preferences-loading-shell" role="dialog" aria-modal="true" aria-labelledby="ec-preferences-title"><header class="ec-preferences-header"><h2 id="ec-preferences-title">${t('preferences.title')}</h2><button type="button" class="paper-icon-button-light ec-preferences-close" aria-label="${t('preferences.close')}"><span class="material-icons" aria-hidden="true">close</span></button></header><div class="ec-preferences-loading" role="status"><span class="ec-preferences-spinner" aria-hidden="true"></span><span>${t('preferences.loading')}</span></div></section>`;
  document.body.appendChild(backdrop);
  const close = (): void => {
    backdrop.remove();
    previouslyFocused?.focus();
  };
  backdrop.querySelector('.ec-preferences-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  try {
    const { current, options } = await loadPreferencesBootstrap();
    if (!backdrop.isConnected) return;
    if (!options.policy.enabled) throw new Error(t('preferences.disabled'));
    const effective = current.effective;
    const dialog = document.createElement('form');
    dialog.className = 'ec-preferences-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ec-preferences-title');
    dialog.innerHTML = `<header class="ec-preferences-header"><h2 id="ec-preferences-title">${t('preferences.title')}</h2><button type="button" class="paper-icon-button-light ec-preferences-close" aria-label="${t('preferences.close')}"><span class="material-icons" aria-hidden="true">close</span></button></header>`;
    const content = document.createElement('div');
    content.className = 'ec-preferences-content';
    content.innerHTML = `<p class="ec-preferences-help">${t('preferences.help')}</p>`;
    const hotkeys = document.createElement('aside');
    hotkeys.className = 'ec-preferences-hotkeys';
    hotkeys.innerHTML = `<strong>${t('preferences.hotkeys')}</strong><span><kbd>M</kbd> ${t('preferences.hotkeyMute')}</span><span><kbd>+ / −</kbd> ${t('preferences.hotkeyVolume')}</span><span><kbd>${t('preferences.hotkeySpace')}</kbd> ${t('preferences.hotkeyPause')}</span>`;
    if (effective.display.enableBackgroundTrailers) content.appendChild(hotkeys);

    const displayFields: Array<[keyof FeaturedEffectiveDisplayPreferences, TranslationKey]> = [
      ['enableBackgroundTrailers', 'trailers.enabled'],
      ['showDescription', 'display.showDescription'],
      ['showRating', 'display.showRatings'],
      ['showYear', 'display.showYear'],
      ['showRuntime', 'display.showRuntime']
    ];
    const display = document.createElement('fieldset');
    display.className = 'ec-preference-display';
    display.innerHTML = `<legend>${t('preferences.display')}</legend><p class="ec-preference-display-help">${t('preferences.displayHelp')}</p>`;
    let displayOptionCount = 0;
    for (const [key, label] of displayFields) {
      if (!current.defaults.display[key]) continue;
      const field = checkbox(t(label), effective.display[key], false);
      field.dataset.displayPreferenceKey = key;
      display.appendChild(field);
      displayOptionCount += 1;
    }
    if (displayOptionCount > 0) content.appendChild(display);

    const sources = document.createElement('fieldset');
    sources.innerHTML = `<legend>${t('preferences.sources')}</legend>`;
    for (const source of options.sources) {
      const row = document.createElement('div');
      row.className = 'ec-preference-source';
      const enabled = checkbox(t(sourceKeys[source.type] ?? 'source.type.random'), effective.sourceEnabled[source.id] ?? source.enabled, !options.policy.allowSourceSelection);
      enabled.dataset.sourceId = source.id;
      const weight = numberField(t('preferences.weight'), effective.sourceWeights[source.id] ?? source.weight, 100);
      weight.dataset.sourceId = source.id;
      weight.querySelector('input')!.disabled = !options.policy.allowSourceWeights;
      row.append(enabled, weight);
      sources.appendChild(row);
    }
    content.appendChild(sources);

    if (options.policy.allowPreferredGenres && options.genres.length) {
      const genres = document.createElement('fieldset');
      genres.className = 'ec-preference-genres';
      genres.innerHTML = `<legend>${t('preferences.genres')}</legend><p class="ec-preference-genres-help">${t('preferences.genresHelp')}</p>`;
      for (const genre of options.genres) {
        const initialState: GenrePreferenceState = effective.excludedGenres.includes(genre)
          ? 'excluded'
          : effective.preferredGenres.includes(genre) ? 'preferred' : 'neutral';
        genres.appendChild(genreSelector(genre, initialState));
      }
      content.appendChild(genres);
    }

    const boosts = document.createElement('fieldset');
    boosts.className = 'ec-preference-boosts';
    boosts.innerHTML = `<legend>${t('preferences.content')}</legend>`;
    const boostFields: Array<[keyof FeaturedUserPreferences, string, number, boolean]> = [
      ['unplayedBoost', t('preferences.unplayed'), effective.unplayedBoost, options.policy.allowUnplayedBoost],
      ['favouriteBoost', t('preferences.favourites'), effective.favouriteBoost, options.policy.allowFavouriteBoost],
      ['inProgressSeriesBoost', t('preferences.inProgress'), effective.inProgressSeriesBoost, options.policy.allowInProgressSeriesBoost]
    ];
    for (const [key, label, value, allowed] of boostFields) {
      if (!allowed) continue;
      const field = numberField(label, value, 100);
      field.dataset.preferenceKey = key;
      boosts.appendChild(field);
    }
    if (options.policy.allowRepeatCooldown) boosts.appendChild(cooldownField(effective.repeatCooldownHours));
    if (boosts.children.length > 1) content.appendChild(boosts);

    dialog.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'ec-preferences-actions';
    actions.innerHTML = `<span class="ec-preferences-status" aria-live="polite"></span><button type="button" class="raised emby-button ec-preferences-reset">${t('preferences.reset')}</button><button type="submit" class="raised button-submit emby-button ec-preferences-save">${t('preferences.save')}</button>`;
    dialog.appendChild(actions);
    replaceElementChildren(backdrop, dialog);
    dialog.querySelector('.ec-preferences-close')?.addEventListener('click', close);
    const status = dialog.querySelector<HTMLElement>('.ec-preferences-status')!;
    const setBusy = (busy: boolean): void => {
      dialog.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = busy; });
    };
    const showSaveError = (error: unknown): void => {
      status.textContent = t('preferences.saveFailed', { error: error instanceof Error ? error.message : String(error) });
    };
    dialog.querySelector('.ec-preferences-reset')?.addEventListener('click', async () => {
      setBusy(true);
      try {
        await requestJson('featured/preferences', { method: 'PUT', body: { reset: true } });
        invalidatePreferencesBootstrap();
        close();
        notifyPreferencesChanged();
      } catch (error) {
        showSaveError(error);
        setBusy(false);
      }
    });
    dialog.addEventListener('submit', async (event) => {
      event.preventDefault();
      const preferences: FeaturedUserPreferences = {
        sourceEnabled: {}, sourceWeights: {},
        display: { ...current.preferences.display },
        preferredGenres: null, excludedGenres: null,
        unplayedBoost: null, favouriteBoost: null, inProgressSeriesBoost: null,
        repeatCooldownDays: null, repeatCooldownHours: null
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
        preferences.preferredGenres = normalized(selectedGenres) === normalized(current.defaults.preferredGenres)
          ? null : selectedGenres;
        preferences.excludedGenres = normalized(excludedGenres) === normalized(current.defaults.excludedGenres)
          ? null : excludedGenres;
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
      setBusy(true);
      try {
        await requestJson('featured/preferences', { method: 'PUT', body: { preferences } });
        invalidatePreferencesBootstrap();
        close();
        notifyPreferencesChanged();
      } catch (error) {
        showSaveError(error);
        setBusy(false);
      }
    });
    dialog.querySelector<HTMLInputElement>('input, button')?.focus();
  } catch (error) {
    if (!backdrop.isConnected) return;
    const loading = backdrop.querySelector<HTMLElement>('.ec-preferences-loading');
    if (loading) {
      loading.setAttribute('role', 'alert');
      replaceElementChildren(loading, document.createTextNode(error instanceof Error ? error.message : String(error)));
    }
    window.setTimeout(() => backdrop.remove(), 3500);
  }
}
