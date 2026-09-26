import { requestJson } from './core/apiClient';
import { config } from './config';
import { FeaturedCarousel } from './slider/carousel';
import { heroImageUrl, logoUrl } from './slider/images';
import { applyHeroLayoutVariables } from './slider/layout';
import type { FeaturedResponse } from './types/featured';
import { cancelAdminNavigationRefresh, isUserSettingsMenu, scheduleAdminNavigationRefresh, setUserSettingsMenuEnabled } from './admin/navigation';
import { CONSOLE_PREFIX, USER_PREFERENCES_CHANGED_EVENT } from './constants';
import {
  clearFeaturedCache,
  getFeaturedCacheScope,
  keepCurrentItem,
  readFeaturedCache,
  saveFeaturedCache
} from './core/featuredCache';

const HOME_SELECTOR = '#indexPage:not(.hide) #homeTab.is-active .homeSectionsContainer, #homeTab.is-active .homeSectionsContainer';
const FRESH_RESPONSE_REUSE_MS = 30_000;
const instances = new Map<Element, FeaturedCarousel>();
const placeholders = new Map<Element, HTMLElement>();
const pendingContainers = new Set<Element>();
let mountFailureAttempts = 0;
let nextMountAttemptAt = 0;
let observer: MutationObserver | null = null;
let scheduled = false;
let removeInactiveOnNextScan = false;
let lifecycleToken = 0;
let routeEventsBound = false;
let routeEventHandler: (() => void) | null = null;
let originalHistoryPushState: History['pushState'] | null = null;
let originalHistoryReplaceState: History['replaceState'] | null = null;
let presetRefreshTimer: number | null = null;
let freshResponseGeneration = 0;
let recentFreshResponse: { scope: string; response: FeaturedResponse; receivedAt: number } | null = null;
let pendingFreshResponse: { scope: string; promise: Promise<FeaturedResponse> } | null = null;
const requestedFreshScopes = new Set<string>();

type HistoryMethodName = 'pushState' | 'replaceState';

function log(message: string, ...details: unknown[]): void {
  if (config.debug) console.debug(`${CONSOLE_PREFIX} ${message}`, ...details);
}

function isTvLayout(): boolean {
  return document.documentElement.classList.contains('layout-tv');
}

function isActiveHomeContainer(container: Element): boolean {
  return container.matches(HOME_SELECTOR) && !container.closest('.page.hide, #indexPage.hide');
}

function canAttemptMount(): boolean {
  return nextMountAttemptAt <= Date.now();
}

function recordMountFailure(): void {
  mountFailureAttempts += 1;
  const retryDelay = Math.min(300_000, 10_000 * (3 ** Math.min(mountFailureAttempts - 1, 3)));
  nextMountAttemptAt = Date.now() + retryDelay;
  log(`Mount failed; retrying in ${Math.round(retryDelay / 1000)} seconds.`);
}

function resetMountFailures(): void {
  mountFailureAttempts = 0;
  nextMountAttemptAt = 0;
}

function schedulePresetRefresh(nextPresetChange?: string): void {
  if (presetRefreshTimer !== null) window.clearTimeout(presetRefreshTimer);
  presetRefreshTimer = null;
  if (!nextPresetChange) return;
  const boundary = new Date(nextPresetChange).getTime();
  if (!Number.isFinite(boundary)) return;
  const remaining = boundary - Date.now();
  if (remaining <= 0) {
    presetRefreshTimer = window.setTimeout(refreshForPresetBoundary, 250);
    return;
  }
  const delay = Math.min(remaining + 250, 2_147_000_000);
  presetRefreshTimer = window.setTimeout(() => {
    presetRefreshTimer = null;
    if (Date.now() < boundary) schedulePresetRefresh(nextPresetChange);
    else refreshForPresetBoundary();
  }, delay);
}

function refreshForPresetBoundary(): void {
  clearFeaturedCache();
  clearFreshResponseMemory();
  lifecycleToken += 1;
  instances.forEach((instance) => instance.destroy());
  instances.clear();
  placeholders.forEach((placeholder) => placeholder.remove());
  placeholders.clear();
  scheduleScan();
}

function refreshForPreferenceChange(): void {
  clearFeaturedCache();
  clearFreshResponseMemory();
  lifecycleToken += 1;
  instances.forEach((instance) => instance.destroy());
  instances.clear();
  placeholders.forEach((placeholder) => placeholder.remove());
  placeholders.clear();
  resetMountFailures();
  scheduleScan();
}

function createPlaceholder(container: Element): HTMLElement {
  const existing = placeholders.get(container);
  if (existing?.isConnected) return existing;

  const placeholder = document.createElement('section');
  placeholder.className = `ec-root ec-placeholder ec-height-${config.heroHeightMode}${config.useHeroLayout ? ' ec-hero' : ''}`;
  placeholder.setAttribute('aria-hidden', 'true');
  applyHeroLayoutVariables(placeholder, config);

  if (config.heading && !config.useHeroLayout) {
    const heading = document.createElement('h2');
    heading.className = 'sectionTitle sectionTitle-cards ec-heading';
    heading.textContent = config.heading;
    placeholder.appendChild(heading);
  }

  const viewport = document.createElement('div');
  viewport.className = 'ec-viewport ec-placeholder-viewport';
  placeholder.appendChild(viewport);
  const bootstrapPlaceholder = container.querySelector(':scope > .ec-bootstrap-placeholder');
  if (bootstrapPlaceholder) bootstrapPlaceholder.replaceWith(placeholder);
  else container.prepend(placeholder);
  placeholders.set(container, placeholder);
  container.closest('#homeTab')?.classList.remove('ec-bootstrap-hero-page');
  container.closest('#homeTab')?.classList.toggle('ec-hero-page', config.useHeroLayout);
  return placeholder;
}

function removePlaceholder(container: Element): void {
  placeholders.get(container)?.remove();
  placeholders.delete(container);
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, 4000);
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) finish();
  });
}

async function preloadFeaturedArtwork(response: FeaturedResponse): Promise<void> {
  const item = response.items[0];
  if (!item) return;
  const urls = [heroImageUrl(item.id, item.imageType, response.reduceImageSizes)];
  if (response.titleDisplayMode === 'logo' && item.hasLogo) {
    urls.push(logoUrl(item.id, response.reduceImageSizes));
  }
  await Promise.all(urls.map(preloadImage));
}

function clearFreshResponseMemory(): void {
  freshResponseGeneration += 1;
  recentFreshResponse = null;
  pendingFreshResponse = null;
}

function getFreshFeaturedResponse(): Promise<FeaturedResponse> {
  const scope = getFeaturedCacheScope();
  const now = Date.now();
  if (scope && recentFreshResponse?.scope === scope
    && now - recentFreshResponse.receivedAt <= FRESH_RESPONSE_REUSE_MS) {
    log('Reused the recent featured response after a remount.');
    return Promise.resolve(recentFreshResponse.response);
  }
  if (scope && pendingFreshResponse?.scope === scope) {
    log('Joined an in-flight featured request after a remount.');
    return pendingFreshResponse.promise;
  }

  const requestScope = scope ?? 'unknown';
  const requestKind = requestedFreshScopes.has(requestScope) ? 'remount' : 'initial';
  requestedFreshScopes.add(requestScope);
  const generation = freshResponseGeneration;
  const promise = requestJson<FeaturedResponse>('featured/items', {
    query: { requestKind }
  }).then((response) => {
    if (scope && generation === freshResponseGeneration && response.items?.length) {
      recentFreshResponse = { scope, response, receivedAt: Date.now() };
    }
    return response;
  }).finally(() => {
    if (pendingFreshResponse?.promise === promise) pendingFreshResponse = null;
  });
  if (scope) pendingFreshResponse = { scope, promise };
  return promise;
}

function createCarousel(response: FeaturedResponse, alreadyDisplayedItemId?: string): FeaturedCarousel {
  return new FeaturedCarousel(
    response,
    async (excludedItemIds) => await requestJson<FeaturedResponse>('featured/items/batch', {
      method: 'POST',
      body: { excludedItemIds }
    }),
    response.trackDisplayedItems
      ? async (itemId) => await requestJson('featured/items/displayed', {
          method: 'POST',
          body: { itemId }
        })
      : undefined,
    alreadyDisplayedItemId
  );
}

function attachCarousel(
  container: Element,
  carousel: FeaturedCarousel,
  response: FeaturedResponse,
  replaced?: FeaturedCarousel
): void {
  if (replaced) {
    replaced.root.replaceWith(carousel.root);
    replaced.destroy();
  } else {
    const placeholder = placeholders.get(container);
    if (placeholder?.isConnected) placeholder.replaceWith(carousel.root);
    else container.prepend(carousel.root);
  }
  carousel.startHeroLayoutGuard();
  placeholders.delete(container);
  instances.set(container, carousel);
  resetMountFailures();
  container.closest('#homeTab')?.classList.toggle('ec-hero-page', response.useHeroLayout);
}

async function mount(container: Element): Promise<void> {
  if (
    instances.has(container) ||
    pendingContainers.has(container) ||
    !canAttemptMount() ||
    container.hasAttribute('data-featured-loading') ||
    container.querySelector(':scope > .ec-root') ||
    (config.hideOnTvLayout && isTvLayout())
  ) return;

  const mountToken = lifecycleToken;
  pendingContainers.add(container);
  container.setAttribute('data-featured-loading', 'true');
  const placeholder = createPlaceholder(container);
  let cachedCarousel: FeaturedCarousel | undefined;
  try {
    const freshResponse = getFreshFeaturedResponse();
    const cachedResponse = readFeaturedCache();
    if (cachedResponse?.items.length && !(cachedResponse.hideOnTvLayout && isTvLayout())) {
      try {
        setUserSettingsMenuEnabled(cachedResponse.personalizationEnabled || cachedResponse.dismissalsEnabled);
        schedulePresetRefresh(cachedResponse.nextPresetChange);
        cachedCarousel = createCarousel(cachedResponse);
        attachCarousel(container, cachedCarousel, cachedResponse);
        log(`Mounted ${cachedResponse.items.length} cached featured items.`);
      } catch (error) {
        cachedCarousel?.destroy();
        if (instances.get(container) === cachedCarousel) instances.delete(container);
        cachedCarousel = undefined;
        clearFeaturedCache();
        console.warn(`${CONSOLE_PREFIX} Could not restore cached featured items.`, error);
      }
    }

    const response = await freshResponse;
    setUserSettingsMenuEnabled(response.personalizationEnabled || response.dismissalsEnabled);
    schedulePresetRefresh(response.nextPresetChange);
    if (
      mountToken !== lifecycleToken ||
      !container.isConnected ||
      !isActiveHomeContainer(container) ||
      (instances.has(container) && instances.get(container) !== cachedCarousel) ||
      Array.from(container.querySelectorAll(':scope > .ec-root')).some((root) => (
        root !== placeholder && root !== cachedCarousel?.root
      )) ||
      !response.items?.length ||
      (response.hideOnTvLayout && isTvLayout())
    ) {
      if (!response.items?.length) {
        console.warn(
          `${CONSOLE_PREFIX} The items response contained no usable items.`,
          { responseKeys: Object.keys(response ?? {}) }
        );
        recordMountFailure();
      }
      if (!response.items?.length || (response.hideOnTvLayout && isTvLayout())) {
        clearFeaturedCache();
        if (cachedCarousel && instances.get(container) === cachedCarousel) {
          cachedCarousel.destroy();
          instances.delete(container);
          cachedCarousel = undefined;
        }
      }
      return;
    }

    saveFeaturedCache(response);
    if (!cachedCarousel) await preloadFeaturedArtwork(response);
    if (
      mountToken !== lifecycleToken ||
      !container.isConnected ||
      !isActiveHomeContainer(container) ||
      (instances.has(container) && instances.get(container) !== cachedCarousel) ||
      Array.from(container.querySelectorAll(':scope > .ec-root')).some((root) => (
        root !== placeholder && root !== cachedCarousel?.root
      ))
    ) return;

    const currentItem = cachedCarousel?.getActiveItem();
    const displayResponse = keepCurrentItem(response, currentItem);
    const carousel = createCarousel(displayResponse, currentItem?.id);
    attachCarousel(container, carousel, displayResponse, cachedCarousel);
    cachedCarousel = undefined;
    log(`Mounted ${response.items.length} featured items.`);
  } catch (error) {
    if (!instances.has(container)) recordMountFailure();
    console.warn(`${CONSOLE_PREFIX} Could not load featured items.`, error);
  } finally {
    const lifecycleChanged = mountToken !== lifecycleToken;
    if (!instances.has(container)) {
      if (
        mountToken === lifecycleToken
        && container.isConnected
        && isActiveHomeContainer(container)
        && !(config.hideOnTvLayout && isTvLayout())
        && canAttemptMount()
      ) recordMountFailure();
      removePlaceholder(container);
      container.closest('#homeTab')?.classList.remove('ec-hero-page');
    }
    pendingContainers.delete(container);
    container.removeAttribute('data-featured-loading');
    if (lifecycleChanged && container.isConnected && isActiveHomeContainer(container)) scheduleScan();
  }
}

export function scan(removeInactive = false): void {
  for (const [container, placeholder] of placeholders) {
    if (!container.isConnected || !placeholder.isConnected) {
      placeholder.remove();
      placeholders.delete(container);
      container.closest('#homeTab')?.classList.remove('ec-hero-page', 'ec-bootstrap-hero-page');
    }
  }
  for (const [container, instance] of instances) {
    const rootWasUnexpectedlyRemoved = container.isConnected
      && isActiveHomeContainer(container)
      && !instance.root.isConnected;
    if (!container.isConnected || !instance.root.isConnected || (removeInactive && !isActiveHomeContainer(container))) {
      if (rootWasUnexpectedlyRemoved) recordMountFailure();
      instance.destroy();
      instances.delete(container);
      container.closest('#homeTab')?.classList.remove('ec-hero-page', 'ec-bootstrap-hero-page');
    }
  }
  document.querySelectorAll(HOME_SELECTOR).forEach((container) => {
    if (!isActiveHomeContainer(container)) return;
    const instance = instances.get(container);
    const placeholder = placeholders.get(container);
    container.querySelectorAll(':scope > .ec-root').forEach((root) => {
      if (root !== instance?.root && root !== placeholder) root.remove();
    });
    void mount(container);
  });
}

export function scheduleScan(removeInactive = false): void {
  removeInactiveOnNextScan ||= removeInactive;
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    const shouldRemoveInactive = removeInactiveOnNextScan;
    removeInactiveOnNextScan = false;
    scan(shouldRemoveInactive);
  });
}

function scheduleFullRefresh(): void {
  scheduleScan(true);
  scheduleAdminNavigationRefresh();
}

function elementContainsHomeSurface(element: Element): boolean {
  return element.matches('#indexPage, #homeTab, .homeSectionsContainer')
    || element.querySelector('#indexPage, #homeTab, .homeSectionsContainer') !== null;
}

function mutationAffectsHome(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  if (!target || target.closest('.ec-root, .ec-bootstrap-placeholder')) return false;
  if (mutation.type === 'attributes') {
    return target.matches('#indexPage, #homeTab, .page');
  }

  const changedElements = [...mutation.addedNodes, ...mutation.removedNodes]
    .filter((node): node is Element => node instanceof Element);
  if (!changedElements.length) return false;
  const isPluginElement = (element: Element): boolean => (
    element.matches('.ec-root, .ec-bootstrap-placeholder')
    || element.closest('.ec-root, .ec-bootstrap-placeholder') !== null
  );
  if (changedElements.every(isPluginElement)) return false;
  if (target.closest('#indexPage, #homeTab, .homeSectionsContainer')) return true;
  return changedElements.some(elementContainsHomeSurface);
}

function mutationAddsAdminNavigation(mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') return false;
  return Array.from(mutation.addedNodes).some((node) => (
    node instanceof Element
    && (node.matches('ul[aria-labelledby="plugins-subheader"]')
      || node.querySelector('ul[aria-labelledby="plugins-subheader"]') !== null
      || isUserSettingsMenu(node)
      || Array.from(node.querySelectorAll('ul[role="menu"]')).some(isUserSettingsMenu)
      || node.matches('#myPreferencesMenuPage')
      || node.querySelector('#myPreferencesMenuPage') !== null)
  ));
}

function trackedMountNeedsRecovery(): boolean {
  for (const [container, instance] of instances) {
    if (!container.isConnected || !instance.root.isConnected) return true;
  }
  for (const [container, placeholder] of placeholders) {
    if (!container.isConnected || !placeholder.isConnected) return true;
  }
  return false;
}

function bindRouteEvents(): void {
  if (routeEventsBound) return;

  routeEventHandler = scheduleFullRefresh;
  window.addEventListener('hashchange', scheduleFullRefresh, { passive: true });
  window.addEventListener('popstate', scheduleFullRefresh, { passive: true });
  document.addEventListener('viewshow', scheduleFullRefresh as EventListener, { passive: true });
  document.addEventListener('pageshow', scheduleFullRefresh as EventListener, { passive: true });
  routeEventsBound = true;

  if (window.history && typeof window.history.pushState === 'function') {
    originalHistoryPushState = window.history.pushState;
    originalHistoryReplaceState = window.history.replaceState;
    (['pushState', 'replaceState'] as HistoryMethodName[]).forEach((methodName) => {
      const original = window.history[methodName];
      window.history[methodName] = function patchedHistoryMethod(
        this: History,
        ...args: Parameters<History[HistoryMethodName]>
      ) {
        const result = original.apply(this, args as never);
        window.setTimeout(scheduleFullRefresh, 0);
        return result;
      } as History[HistoryMethodName];
    });
  }
}

function unbindRouteEvents(): void {
  if (routeEventHandler) {
    window.removeEventListener('hashchange', routeEventHandler);
    window.removeEventListener('popstate', routeEventHandler);
    document.removeEventListener('viewshow', routeEventHandler as EventListener);
    document.removeEventListener('pageshow', routeEventHandler as EventListener);
  }
  routeEventHandler = null;
  routeEventsBound = false;

  if (originalHistoryPushState) window.history.pushState = originalHistoryPushState;
  if (originalHistoryReplaceState) window.history.replaceState = originalHistoryReplaceState;
  originalHistoryPushState = null;
  originalHistoryReplaceState = null;
}

export function start(): void {
  if (observer) return;
  window.JellyfinFeaturedBootstrap?.stop();
  lifecycleToken += 1;
  observer = new MutationObserver((mutations) => {
    const hasTrackedMount = instances.size > 0 || placeholders.size > 0 || pendingContainers.size > 0;
    if (trackedMountNeedsRecovery() || (!hasTrackedMount && mutations.some(mutationAffectsHome))) scheduleScan();
    if (mutations.some(mutationAddsAdminNavigation)) scheduleAdminNavigationRefresh();
  });
  observer.observe(document.getElementById('reactRoot') ?? document.body, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });
  bindRouteEvents();
  document.addEventListener(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange);
  scheduleFullRefresh();
}

export function destroy(): void {
  lifecycleToken += 1;
  observer?.disconnect();
  observer = null;
  unbindRouteEvents();
  document.removeEventListener(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange);
  cancelAdminNavigationRefresh();
  if (presetRefreshTimer !== null) window.clearTimeout(presetRefreshTimer);
  presetRefreshTimer = null;
  instances.forEach((instance) => instance.destroy());
  instances.clear();
  placeholders.forEach((placeholder) => placeholder.remove());
  placeholders.clear();
  pendingContainers.clear();
  resetMountFailures();
  removeInactiveOnNextScan = false;
  document.querySelectorAll('[data-featured-loading]').forEach((element) => {
    element.removeAttribute('data-featured-loading');
  });
  document.querySelectorAll('.ec-root').forEach((element) => element.remove());
  document.querySelectorAll('#homeTab.ec-hero-page').forEach((element) => element.classList.remove('ec-hero-page'));
}

export function refresh(): void {
  destroy();
  start();
}
