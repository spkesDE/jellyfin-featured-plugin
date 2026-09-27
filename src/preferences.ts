import { requestJson } from './core/apiClient';
import { replaceElementChildren } from './core/dom';
import { t, type TranslationKey } from './i18n';
import type { FeaturedEffectiveDisplayPreferences, FeaturedUserPreferences } from './types/featured';
import { USER_PREFERENCES_CHANGED_EVENT } from './constants';
import {
  createCheckbox,
  createCooldownField,
  createGenreSelector,
  createNumberField,
  type GenrePreferenceState
} from './preferencesFields';
import { invalidatePreferencesBootstrap, loadPreferencesBootstrap } from './preferencesApi';
import { serializePreferencesForm } from './preferencesForm';
import {
  createPreferencesActions,
  createPreferencesHeader,
  createPreferencesHotkeys,
  PreferencesDialogShell
} from './preferencesDialogShell';
import { PreferencesActionStatus } from './preferencesActionStatus';
import { createDismissalsSection } from './preferencesDismissals';
import { createPreferenceFieldset, createTextElement } from './preferencesDom';

export { invalidatePreferencesBootstrap, preloadPreferencesDialog } from './preferencesApi';

const sourceKeys: Record<string, TranslationKey> = {
  LIBRARIES: 'source.type.libraries',
  COLLECTIONS: 'source.type.collections',
  FAVOURITES: 'source.type.favourites',
  TAGS: 'source.type.tags',
  PLAYLISTS: 'source.type.playlists',
  RECENTLY_ADDED: 'source.type.recently_added',
  LATEST_RELEASES: 'source.type.latest_releases',
  RANDOM: 'source.type.random',
  UNPLAYED: 'source.type.unplayed',
  MANUAL_LISTS: 'source.type.manual_lists',
  RECOMMENDATIONS: 'source.type.recommendations'
};

function notifyPreferencesChanged(): void {
  document.dispatchEvent(new CustomEvent(USER_PREFERENCES_CHANGED_EVENT));
}

export async function openPreferencesDialog(): Promise<void> {
  if (document.querySelector('.ec-preferences-backdrop')) return;
  const shell = new PreferencesDialogShell();
  shell.attach();

  try {
    const { current, options, dismissals } = await loadPreferencesBootstrap();
    if (!shell.isConnected) return;
    if (!options.policy.enabled && !dismissals.policy.enabled && !dismissals.entries.length) {
      throw new Error(t('preferences.disabled'));
    }
    const effective = current.effective;
    const dialog = document.createElement('form');
    dialog.className = 'ec-preferences-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ec-preferences-title');
    dialog.appendChild(createPreferencesHeader());
    const actions = createPreferencesActions(options.policy.enabled || dismissals.policy.enabled);
    const actionStatus = new PreferencesActionStatus(dialog, actions.status);
    const content = document.createElement('div');
    content.className = 'ec-preferences-content';
    content.appendChild(createTextElement('p', t('preferences.help'), 'ec-preferences-help'));
    const hotkeys = createPreferencesHotkeys();
    if (effective.display.enableBackgroundTrailers) content.appendChild(hotkeys);

    const displayFields: Array<[keyof FeaturedEffectiveDisplayPreferences, TranslationKey]> = options.policy.enabled
      ? [
          ['enableBackgroundTrailers', 'trailers.enabled'],
          ['showDescription', 'display.showDescription'],
          ['showRating', 'display.showRatings'],
          ['showYear', 'display.showYear'],
          ['showRuntime', 'display.showRuntime'],
          ['showFavoriteButton', 'display.showFavoriteButton'],
          ['showPlaystateButton', 'display.showPlaystateButton']
        ]
      : [];
    if (dismissals.policy.enabled) displayFields.push(['showDismissalButton', 'display.showDismissalButton']);
    const display = createPreferenceFieldset(
      t('preferences.display'),
      t('preferences.displayHelp'),
      'ec-preference-display'
    );
    let displayOptionCount = 0;
    for (const [key, label] of displayFields) {
      if (!current.defaults.display[key]) continue;
      const field = createCheckbox(t(label), effective.display[key], false);
      field.dataset.displayPreferenceKey = key;
      display.appendChild(field);
      displayOptionCount += 1;
    }
    if (displayOptionCount > 0) content.appendChild(display);

    const sources = createPreferenceFieldset(t('preferences.sources'));
    for (const source of options.sources) {
      const row = document.createElement('div');
      row.className = 'ec-preference-source';
      const enabled = createCheckbox(
        t(sourceKeys[source.type] ?? 'source.type.random'),
        effective.sourceEnabled[source.id] ?? source.enabled,
        !options.policy.allowSourceSelection
      );
      enabled.dataset.sourceId = source.id;
      const weight = createNumberField(
        t('preferences.weight'),
        effective.sourceWeights[source.id] ?? source.weight,
        100
      );
      weight.dataset.sourceId = source.id;
      weight.querySelector('input')!.disabled = !options.policy.allowSourceWeights;
      row.append(enabled, weight);
      sources.appendChild(row);
    }
    content.appendChild(sources);

    if (options.policy.allowPreferredGenres && options.genres.length) {
      const genres = createPreferenceFieldset(
        t('preferences.genres'),
        t('preferences.genresHelp'),
        'ec-preference-genres'
      );
      for (const genre of options.genres) {
        const initialState: GenrePreferenceState = effective.excludedGenres.includes(genre)
          ? 'excluded'
          : effective.preferredGenres.includes(genre)
            ? 'preferred'
            : 'neutral';
        genres.appendChild(createGenreSelector(genre, initialState));
      }
      content.appendChild(genres);
    }

    const boosts = createPreferenceFieldset(t('preferences.content'), undefined, 'ec-preference-boosts');
    const boostFields: Array<[keyof FeaturedUserPreferences, string, number, boolean]> = [
      ['unplayedBoost', t('preferences.unplayed'), effective.unplayedBoost, options.policy.allowUnplayedBoost],
      ['favouriteBoost', t('preferences.favourites'), effective.favouriteBoost, options.policy.allowFavouriteBoost],
      [
        'inProgressSeriesBoost',
        t('preferences.inProgress'),
        effective.inProgressSeriesBoost,
        options.policy.allowInProgressSeriesBoost
      ]
    ];
    for (const [key, label, value, allowed] of boostFields) {
      if (!allowed) continue;
      const field = createNumberField(label, value, 100);
      field.dataset.preferenceKey = key;
      boosts.appendChild(field);
    }
    if (options.policy.allowRepeatCooldown) boosts.appendChild(createCooldownField(effective.repeatCooldownHours));
    if (boosts.children.length > 1) content.appendChild(boosts);

    if (!options.policy.enabled) {
      replaceElementChildren(content, createTextElement('p', t('preferences.disabled'), 'ec-preferences-help'));
      if (displayOptionCount > 0) content.appendChild(display);
    }

    if (dismissals.policy.enabled || dismissals.entries.length) {
      content.appendChild(createDismissalsSection(dismissals, actionStatus));
    }

    dialog.appendChild(content);

    dialog.appendChild(actions.root);
    shell.replaceContent(dialog);
    dialog.querySelector('.ec-preferences-reset')?.addEventListener('click', async () => {
      const succeeded = await actionStatus.run(async () => {
        await requestJson('featured/preferences', { method: 'PUT', body: { reset: true } });
      });
      if (succeeded) {
        invalidatePreferencesBootstrap();
        shell.close();
        notifyPreferencesChanged();
      }
    });
    dialog.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!options.policy.enabled && !dismissals.policy.enabled) return;
      const preferences: FeaturedUserPreferences = serializePreferencesForm(dialog, current, options);
      const succeeded = await actionStatus.run(async () => {
        await requestJson('featured/preferences', { method: 'PUT', body: { preferences } });
      });
      if (succeeded) {
        invalidatePreferencesBootstrap();
        shell.close();
        notifyPreferencesChanged();
      }
    });
    dialog.querySelector<HTMLInputElement>('input, button')?.focus();
  } catch (error) {
    if (!shell.isConnected) return;
    shell.showTemporaryError(error);
  }
}
