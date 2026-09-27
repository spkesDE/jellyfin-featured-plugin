import { USER_PREFERENCES_CHANGED_EVENT } from './constants';
import { requestJson } from './core/apiClient';
import { replaceElementChildren } from './core/dom';
import { t, type TranslationKey } from './i18n';
import { PreferencesActionStatus } from './preferencesActionStatus';
import { invalidatePreferencesBootstrap } from './preferencesApi';
import { createMaterialIcon, createPreferenceFieldset, createTextElement } from './preferencesDom';
import type { FeaturedDismissalsResponse } from './types/featured';

export function createDismissalsSection(
  dismissals: FeaturedDismissalsResponse,
  actions: PreferencesActionStatus
): HTMLFieldSetElement {
  const section = createPreferenceFieldset(t('preferences.dismissals'));
  const list = document.createElement('div');
  list.className = 'itemsContainer';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'raised emby-button';
  reset.textContent = t('preferences.clearDismissals');

  const changed = (): void => {
    invalidatePreferencesBootstrap();
    render();
    document.dispatchEvent(new CustomEvent(USER_PREFERENCES_CHANGED_EVENT));
  };

  const render = (): void => {
    replaceElementChildren(list);
    reset.hidden = dismissals.entries.length === 0;
    if (!dismissals.entries.length) {
      list.appendChild(createTextElement('p', t('preferences.noDismissals'), 'ec-preferences-help'));
      return;
    }

    for (const entry of dismissals.entries) {
      const row = document.createElement('div');
      row.className = 'listItem listItem-border';
      const label = document.createElement('span');
      label.className = 'listItemBody';
      label.append(
        createTextElement('span', entry.name, 'listItemBodyText'),
        createTextElement('span', t(`preferences.scope.${entry.scope}` as TranslationKey), 'listItemBodyText secondary')
      );
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'paper-icon-button-light';
      remove.setAttribute('aria-label', t('preferences.removeDismissal', { name: entry.name }));
      remove.appendChild(createMaterialIcon('restore'));
      remove.addEventListener('click', async () => {
        const succeeded = await actions.run(async () => {
          await requestJson('featured/dismissals/undo', {
            method: 'POST',
            body: { dismissalId: entry.id }
          });
        });
        if (!succeeded) return;
        dismissals.entries = dismissals.entries.filter((candidate) => candidate.id !== entry.id);
        changed();
      });
      row.append(label, remove);
      list.appendChild(row);
    }
  };

  reset.addEventListener('click', async () => {
    const succeeded = await actions.run(async () => {
      await requestJson('featured/dismissals/reset', { method: 'POST' });
    });
    if (!succeeded) return;
    dismissals.entries = [];
    changed();
  });
  render();
  section.append(list, reset);
  return section;
}
