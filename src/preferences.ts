import { requestJson } from './core/apiClient';
import { t, type TranslationKey } from './i18n';
import type {
  FeaturedPreferenceOptions,
  FeaturedPreferencesResponse,
  FeaturedUserPreferences
} from './types/featured';

const sourceKeys: Record<string, TranslationKey> = {
  LIBRARIES: 'source.type.libraries', COLLECTIONS: 'source.type.collections', FAVOURITES: 'source.type.favourites',
  TAGS: 'source.type.tags', PLAYLISTS: 'source.type.playlists', RECENTLY_ADDED: 'source.type.recently_added',
  LATEST_RELEASES: 'source.type.latest_releases', RANDOM: 'source.type.random', UNPLAYED: 'source.type.unplayed',
  MANUAL_LISTS: 'source.type.manual_lists'
};

function checkbox(label: string, checked: boolean, disabled: boolean): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'ec-preference-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  wrapper.append(input, document.createTextNode(label));
  return wrapper;
}

function numberField(label: string, value: number, max: number): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'ec-preference-number';
  const text = document.createElement('span');
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  wrapper.append(text, input);
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
  const backdrop = document.createElement('div');
  backdrop.className = 'ec-preferences-backdrop';
  backdrop.innerHTML = `<div class="ec-preferences-loading" role="status">${t('preferences.loading')}</div>`;
  document.body.appendChild(backdrop);

  try {
    const [current, options] = await Promise.all([
      requestJson<FeaturedPreferencesResponse>('featured/preferences'),
      requestJson<FeaturedPreferenceOptions>('featured/preferences/options')
    ]);
    if (!options.policy.enabled) throw new Error(t('preferences.disabled'));
    const effective = current.effective;
    const dialog = document.createElement('form');
    dialog.className = 'ec-preferences-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ec-preferences-title');
    dialog.innerHTML = `<header><h2 id="ec-preferences-title">${t('preferences.title')}</h2><button type="button" class="ec-preferences-close" aria-label="${t('preferences.close')}">×</button></header><p>${t('preferences.help')}</p>`;
    const hotkeys = document.createElement('aside');
    hotkeys.className = 'ec-preferences-hotkeys';
    hotkeys.innerHTML = `<strong>${t('preferences.hotkeys')}</strong><span><kbd>M</kbd> ${t('preferences.hotkeyMute')}</span><span><kbd>+ / −</kbd> ${t('preferences.hotkeyVolume')}</span><span><kbd>${t('preferences.hotkeySpace')}</kbd> ${t('preferences.hotkeyPause')}</span>`;
    dialog.appendChild(hotkeys);

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
    dialog.appendChild(sources);

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
      dialog.appendChild(genres);
    }

    const boosts = document.createElement('fieldset');
    boosts.className = 'ec-preference-boosts';
    boosts.innerHTML = `<legend>${t('preferences.content')}</legend>`;
    const boostFields: Array<[keyof FeaturedUserPreferences, string, number, boolean]> = [
      ['unplayedBoost', t('preferences.unplayed'), effective.unplayedBoost, options.policy.allowUnplayedBoost],
      ['favouriteBoost', t('preferences.favourites'), effective.favouriteBoost, options.policy.allowFavouriteBoost],
      ['inProgressSeriesBoost', t('preferences.inProgress'), effective.inProgressSeriesBoost, options.policy.allowInProgressSeriesBoost],
      ['repeatCooldownDays', t('preferences.cooldown'), effective.repeatCooldownDays, options.policy.allowRepeatCooldown]
    ];
    for (const [key, label, value, allowed] of boostFields) {
      if (!allowed) continue;
      const field = numberField(label, value, key === 'repeatCooldownDays' ? 3650 : 100);
      field.dataset.preferenceKey = key;
      boosts.appendChild(field);
    }
    if (boosts.children.length > 1) dialog.appendChild(boosts);

    const actions = document.createElement('div');
    actions.className = 'ec-preferences-actions';
    actions.innerHTML = `<span class="ec-preferences-status" aria-live="polite"></span><button type="button" class="ec-preferences-reset">${t('preferences.reset')}</button><button type="submit" class="ec-preferences-save">${t('preferences.save')}</button>`;
    dialog.appendChild(actions);
    backdrop.replaceChildren(dialog);
    const close = (): void => backdrop.remove();
    dialog.querySelector('.ec-preferences-close')?.addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
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
        close();
      } catch (error) {
        showSaveError(error);
        setBusy(false);
      }
    });
    dialog.addEventListener('submit', async (event) => {
      event.preventDefault();
      const preferences: FeaturedUserPreferences = {
        sourceEnabled: {}, sourceWeights: {}, preferredGenres: null, excludedGenres: null,
        unplayedBoost: null, favouriteBoost: null, inProgressSeriesBoost: null, repeatCooldownDays: null
      };
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
        const key = field.dataset.preferenceKey as 'unplayedBoost' | 'favouriteBoost' | 'inProgressSeriesBoost' | 'repeatCooldownDays';
        const value = Number(field.querySelector<HTMLInputElement>('input')!.value);
        if (value !== current.defaults[key]) preferences[key] = value;
      });
      setBusy(true);
      try {
        await requestJson('featured/preferences', { method: 'PUT', body: { preferences } });
        close();
      } catch (error) {
        showSaveError(error);
        setBusy(false);
      }
    });
    dialog.querySelector<HTMLInputElement>('input, button')?.focus();
  } catch (error) {
    backdrop.innerHTML = `<div class="ec-preferences-loading" role="alert">${error instanceof Error ? error.message : String(error)}</div>`;
    window.setTimeout(() => backdrop.remove(), 3500);
  }
}
