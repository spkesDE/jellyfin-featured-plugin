import {
  ADMIN_NAV_LINK_ATTR,
  CONFIGURATION_PAGE_HASH,
  CONFIGURATION_PAGE_NAME,
  PLUGIN_DISPLAY_NAME
} from '../constants';
import { config } from '../config';
import { t } from '../i18n';
import { openPreferencesDialog, preloadPreferencesDialog } from '../preferences';

const USER_SETTINGS_LINK_ATTR = 'data-featured-user-settings-link';
const USER_SETTINGS_PAGE_LINK_ATTR = 'data-featured-user-settings-page-link';
const USER_PREFERENCES_SELECTOR = 'a[href="#/mypreferencesmenu"], a[href$="/#/mypreferencesmenu"]';

let refreshScheduled = false;
let refreshFrame: number | null = null;
let userSettingsEnabled = config.personalizationEnabled;

export function isUserSettingsMenu(element: Element): boolean {
  return element.matches('ul[role="menu"]') && element.querySelector(USER_PREFERENCES_SELECTOR) !== null;
}

export function ensureUserSettingsMenuEntry(): void {
  document.querySelectorAll<HTMLElement>('ul[role="menu"]').forEach((menu) => {
    if (!isUserSettingsMenu(menu)) return;
    const existing = menu.querySelector<HTMLElement>(`[${USER_SETTINGS_LINK_ATTR}="true"]`);
    if (!userSettingsEnabled) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const settingsEntry = menu.querySelector<HTMLAnchorElement>(USER_PREFERENCES_SELECTOR);
    if (!settingsEntry) return;
    const entry = settingsEntry.cloneNode(true) as HTMLAnchorElement;
    entry.setAttribute(USER_SETTINGS_LINK_ATTR, 'true');
    entry.href = '#';
    entry.removeAttribute('id');
    entry.querySelector('.MuiListItemIcon-root')?.replaceChildren(createUserSettingsIcon());
    const label = entry.querySelector('.MuiListItemText-primary') ?? entry.querySelector('.MuiTypography-root');
    if (label) label.textContent = t('preferences.menuEntry');
    else entry.textContent = t('preferences.menuEntry');
    entry.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      window.setTimeout(() => void openPreferencesDialog(), 0);
    });
    entry.addEventListener('pointerenter', preloadPreferencesDialog, { once: true });
    entry.addEventListener('focus', preloadPreferencesDialog, { once: true });
    settingsEntry.after(entry);
  });
}

export function ensureUserSettingsPageEntry(): void {
  const page = document.querySelector<HTMLElement>('#myPreferencesMenuPage');
  if (!page) return;
  const existing = page.querySelector<HTMLElement>(`[${USER_SETTINGS_PAGE_LINK_ATTR}="true"]`);
  if (!userSettingsEnabled) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const section = page.querySelector<HTMLElement>('.readOnlyContent > .verticalSection')
    ?? page.querySelector<HTMLElement>('.verticalSection');
  const template = section?.querySelector<HTMLAnchorElement>('.lnkHomePreferences')
    ?? section?.querySelector<HTMLAnchorElement>('a.listItem-border');
  if (!section || !template) return;

  const entry = template.cloneNode(true) as HTMLAnchorElement;
  entry.setAttribute(USER_SETTINGS_PAGE_LINK_ATTR, 'true');
  entry.setAttribute('href', '#');
  entry.removeAttribute('id');
  Array.from(entry.classList).filter((className) => className.startsWith('lnk')).forEach((className) => {
    entry.classList.remove(className);
  });
  const icon = entry.querySelector<HTMLElement>('.listItemIcon');
  if (icon) {
    icon.className = 'material-icons listItemIcon listItemIcon-transparent';
    icon.textContent = 'view_carousel';
  }
  const label = entry.querySelector('.listItemBodyText');
  if (label) label.textContent = t('preferences.menuEntry');
  else entry.textContent = t('preferences.menuEntry');
  entry.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void openPreferencesDialog();
  });
  entry.addEventListener('pointerenter', preloadPreferencesDialog, { once: true });
  entry.addEventListener('focus', preloadPreferencesDialog, { once: true });
  section.appendChild(entry);
  preloadPreferencesDialog();
}

function createUserSettingsIcon(): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'view_carousel';
  return icon;
}

export function setUserSettingsMenuEnabled(enabled: boolean): void {
  userSettingsEnabled = enabled;
  if (!enabled) {
    document.querySelectorAll(`[${USER_SETTINGS_LINK_ATTR}="true"]`).forEach((entry) => entry.remove());
    document.querySelectorAll(`[${USER_SETTINGS_PAGE_LINK_ATTR}="true"]`).forEach((entry) => entry.remove());
  } else {
    scheduleAdminNavigationRefresh();
  }
}

export function isPluginConfigurationLink(element: Element | null): boolean {
  return !!(
    element &&
    element.tagName === 'A' &&
    typeof element.getAttribute === 'function' &&
    (element.getAttribute('href') || '').includes('#/configurationpage?name=')
  );
}

export function getAdminNavigationContainers(): HTMLElement[] {
  const containers = new Set<HTMLElement>();
  const muiPluginsContainer = document.querySelector<HTMLElement>(
    'ul[aria-labelledby="plugins-subheader"]'
  );

  if (muiPluginsContainer) containers.add(muiPluginsContainer);
  return Array.from(containers);
}

export function isFeaturedConfigurationRoute(): boolean {
  const hash = window.location.hash || '';
  if (!hash) return false;

  try {
    const normalizedHash = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    const routeUrl = new URL(normalizedHash, window.location.origin);
    return routeUrl.pathname === '/configurationpage' &&
      routeUrl.searchParams.get('name') === CONFIGURATION_PAGE_NAME;
  } catch {
    return hash.includes(CONFIGURATION_PAGE_HASH);
  }
}

export function isPluginsDashboardRoute(): boolean {
  const hash = window.location.hash || '';
  return hash === '#/dashboard/plugins' || hash.startsWith('#/dashboard/plugins?');
}

export function getSelectedNavClasses(container: HTMLElement, currentEntry: Element | null): string[] {
  const selectedCandidate = Array.from(container.children).find((child) => {
    if (!(child instanceof HTMLElement) || child === currentEntry) return false;
    return child.classList.contains('Mui-selected');
  });

  if (!selectedCandidate) return [];
  return Array.from(selectedCandidate.classList).filter((className) => className === 'Mui-selected');
}

export function setAdminNavigationEntrySelected(
  entry: Element,
  isSelected: boolean,
  selectedClasses: string[]
): void {
  if (!(entry instanceof HTMLElement)) return;

  if (isSelected) {
    entry.setAttribute('aria-current', 'page');
    ['Mui-selected'].concat(selectedClasses || []).forEach((className) => entry.classList.add(className));
  } else {
    entry.removeAttribute('aria-current');
    entry.classList.remove('Mui-selected');
  }
}

export function syncPluginsRootSelection(shouldSelectCustomEntry: boolean): void {
  const pluginsLinks = Array.from(document.querySelectorAll(
    'a[href="#/plugins"], a[href$="/#/plugins"], a[href="#/dashboard/plugins"], a[href$="/#/dashboard/plugins"]'
  ));

  pluginsLinks.forEach((link) => {
    if (!(link instanceof HTMLElement) || link.getAttribute(ADMIN_NAV_LINK_ATTR) === 'true') return;

    if (shouldSelectCustomEntry) {
      link.removeAttribute('aria-current');
      link.classList.remove('Mui-selected');
    } else if (isPluginsDashboardRoute()) {
      link.setAttribute('aria-current', 'page');
      link.classList.add('Mui-selected');
    }
  });
}

export function updateAdminNavigationEntry(entry: Element): void {
  entry.setAttribute(ADMIN_NAV_LINK_ATTR, 'true');
  entry.setAttribute('href', CONFIGURATION_PAGE_HASH);
  entry.setAttribute('title', PLUGIN_DISPLAY_NAME);
  entry.removeAttribute('id');

  const labelSelectors = [
    '.MuiListItemText-primary',
    '.MuiTypography-root.MuiListItemText-primary',
    '.navMenuOptionText',
    '.listItemBodyText',
    '.drawerLinkText',
    '.sectionTitleText',
    '.button-text'
  ];
  let label: Element | null = null;

  for (const selector of labelSelectors) {
    label = entry.querySelector(selector);
    if (label) break;
  }

  if (!label) {
    const spans = entry.querySelectorAll('span');
    label = spans.length ? spans[spans.length - 1] : null;
  }

  if (label) label.textContent = PLUGIN_DISPLAY_NAME;
  else entry.textContent = PLUGIN_DISPLAY_NAME;
}

export function ensureAdminNavigationLink(): void {
  const shouldSelectEntry = isFeaturedConfigurationRoute();
  const containers = getAdminNavigationContainers();
  if (!containers.length) return;

  containers.forEach((container) => {
    const selectedClasses = getSelectedNavClasses(container, null);
    syncPluginsRootSelection(shouldSelectEntry);
    const existing = Array.from(container.children).find((child) => (
      isPluginConfigurationLink(child) && (child.getAttribute('href') || '') === CONFIGURATION_PAGE_HASH
    ));

    if (existing) {
      updateAdminNavigationEntry(existing);
      setAdminNavigationEntrySelected(existing, shouldSelectEntry, selectedClasses);
      return;
    }

    const template = Array.from(container.children).find((child) => isPluginConfigurationLink(child)) ||
      container.querySelector('a[href="#/dashboard/plugins"], a[href="#/plugins"]');
    if (!template) return;

    const entry = template.cloneNode(true) as Element;
    updateAdminNavigationEntry(entry);
    setAdminNavigationEntrySelected(entry, shouldSelectEntry, selectedClasses);
    container.appendChild(entry);
  });
}

export function scheduleAdminNavigationRefresh(): void {
  if (refreshFrame !== null || refreshScheduled) return;

  refreshScheduled = true;
  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = null;
    refreshScheduled = false;
    ensureAdminNavigationLink();
    ensureUserSettingsMenuEntry();
    ensureUserSettingsPageEntry();
  });
}

export function cancelAdminNavigationRefresh(): void {
  if (refreshFrame !== null) {
    window.cancelAnimationFrame(refreshFrame);
    refreshFrame = null;
  }
  refreshScheduled = false;
}
