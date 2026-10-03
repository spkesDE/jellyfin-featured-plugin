import { requestJson } from './core/apiClient';
import { config } from './config';
import { FeaturedCarousel } from './slider/carousel';
import { heroImageUrl, logoUrl } from './slider/images';
import { applyHeroLayoutVariables } from './slider/layout';
import type { FeaturedResponse } from './types/featured';
import {
  cancelAdminNavigationRefresh,
  isUserSettingsMenu,
  scheduleAdminNavigationRefresh,
  setUserSettingsMenuEnabled
} from './admin/navigation';
import { CONSOLE_PREFIX, USER_PREFERENCES_CHANGED_EVENT } from './constants';
import {
  clearFeaturedCache,
  getFeaturedCacheScope,
  keepCurrentItem,
  readFeaturedCache,
  saveFeaturedCache
} from './core/featuredCache';
import { FreshResponseCache } from './core/freshResponseCache';
import { RuntimeCoordinator } from './core/runtimeCoordinator';
import { shouldScheduleRuntimeScan } from './core/runtimeMutationPolicy';

/**
 * Runtime lifecycle invariants:
 * - the mount state's lifecycle token invalidates asynchronous work from an older lifecycle;
 * - each container has at most one pending mount and one mounted carousel/placeholder;
 * - mount backoff survives preset boundaries, but an explicit preference change resets it;
 * - RouteObserver owns and restores every patched history method.
 */

const HOME_SELECTOR =
  '#indexPage:not(.hide) #homeTab.is-active .homeSectionsContainer, #homeTab.is-active .homeSectionsContainer';
const ARTWORK_PRELOAD_TIMEOUT_MS = 4000;
const runtimeCoordinator = new RuntimeCoordinator<FeaturedCarousel>({
  scan,
  routeChanged: scheduleFullRefresh,
  mutationsObserved: handleMutations,
  presetBoundaryReached: refreshForPresetBoundary
});
const mountState = runtimeCoordinator.mounts;
const { instances, placeholders, pendingContainers } = mountState;
const freshResponseCache = new FreshResponseCache<FeaturedResponse>(
  30_000,
  (response) => Boolean(response.items?.length),
  (kind) =>
    log(
      kind === 'recent'
        ? 'Reused the recent featured response after a remount.'
        : 'Joined an in-flight featured request after a remount.'
    )
);

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
  return mountState.canAttemptMount();
}

function recordMountFailure(): void {
  const retryDelay = mountState.recordMountFailure();
  log(`Mount failed; retrying in ${Math.round(retryDelay / 1000)} seconds.`);
}

function resetMountFailures(): void {
  mountState.resetMountFailures();
}

function schedulePresetRefresh(nextPresetChange?: string): void {
  runtimeCoordinator.schedulePresetRefresh(nextPresetChange);
}

function refreshForPresetBoundary(): void {
  resetMountedContent(false);
}

function refreshForPreferenceChange(): void {
  resetMountedContent(true);
}

function resetMountedContent(resetBackoff: boolean): void {
  clearFeaturedCache();
  clearFreshResponseMemory();
  runtimeCoordinator.schedulePresetRefresh();
  mountState.beginLifecycle();
  instances.forEach((instance) => instance.destroy());
  instances.clear();
  placeholders.forEach((placeholder) => placeholder.remove());
  placeholders.clear();
  if (resetBackoff) resetMountFailures();
  scheduleScan();
}

function createPlaceholder(container: Element): HTMLElement {
  const existing = placeholders.get(container);
  if (existing?.isConnected) return existing;

  const placeholder = document.createElement('section');
  placeholder.className = `featured-root featured-placeholder featured-height-${config.heroHeightMode}${config.useHeroLayout ? ' featured-hero' : ''}`;
  placeholder.setAttribute('aria-hidden', 'true');
  applyHeroLayoutVariables(placeholder, config);

  if (config.heading && !config.useHeroLayout) {
    const heading = document.createElement('h2');
    heading.className = 'sectionTitle sectionTitle-cards featured-heading';
    heading.textContent = config.heading;
    placeholder.appendChild(heading);
  }

  const viewport = document.createElement('div');
  viewport.className = 'featured-viewport featured-placeholder-viewport';
  placeholder.appendChild(viewport);
  const bootstrapPlaceholder = container.querySelector(':scope > .featured-bootstrap-placeholder');
  if (bootstrapPlaceholder) bootstrapPlaceholder.replaceWith(placeholder);
  else container.prepend(placeholder);
  placeholders.set(container, placeholder);
  container.closest('#homeTab')?.classList.remove('featured-bootstrap-hero-page');
  container.closest('#homeTab')?.classList.toggle('featured-hero-page', config.useHeroLayout);
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
    const timeout = window.setTimeout(finish, ARTWORK_PRELOAD_TIMEOUT_MS);
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
  freshResponseCache.clear();
}

function getFreshFeaturedResponse(): Promise<FeaturedResponse> {
  const scope = getFeaturedCacheScope();
  return freshResponseCache.get(scope, (requestKind) =>
    requestJson<FeaturedResponse>('featured/items', { query: { requestKind } })
  );
}

function createCarousel(response: FeaturedResponse, alreadyDisplayedItemId?: string): FeaturedCarousel {
  return new FeaturedCarousel(
    response,
    async (excludedItemIds) =>
      await requestJson<FeaturedResponse>('featured/items/batch', {
        method: 'POST',
        body: { excludedItemIds }
      }),
    response.trackDisplayedItems
      ? async (itemId) =>
          await requestJson('featured/items/displayed', {
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
  carousel.startLayoutGuards();
  placeholders.delete(container);
  instances.set(container, carousel);
  resetMountFailures();
  container.closest('#homeTab')?.classList.toggle('featured-hero-page', response.useHeroLayout);
}

async function mount(container: Element): Promise<void> {
  if (
    instances.has(container) ||
    pendingContainers.has(container) ||
    !canAttemptMount() ||
    container.hasAttribute('data-featured-loading') ||
    container.querySelector(':scope > .featured-root') ||
    (config.hideOnTvLayout && isTvLayout())
  )
    return;

  const mountToken = mountState.lifecycleToken;
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
      mountToken !== mountState.lifecycleToken ||
      !container.isConnected ||
      !isActiveHomeContainer(container) ||
      (instances.has(container) && instances.get(container) !== cachedCarousel) ||
      Array.from(container.querySelectorAll(':scope > .featured-root')).some(
        (root) => root !== placeholder && root !== cachedCarousel?.root
      ) ||
      !response.items?.length ||
      (response.hideOnTvLayout && isTvLayout())
    ) {
      if (!response.items?.length) {
        console.warn(`${CONSOLE_PREFIX} The items response contained no usable items.`, {
          responseKeys: Object.keys(response ?? {})
        });
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
      mountToken !== mountState.lifecycleToken ||
      !container.isConnected ||
      !isActiveHomeContainer(container) ||
      (instances.has(container) && instances.get(container) !== cachedCarousel) ||
      Array.from(container.querySelectorAll(':scope > .featured-root')).some(
        (root) => root !== placeholder && root !== cachedCarousel?.root
      )
    )
      return;

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
    const lifecycleChanged = mountToken !== mountState.lifecycleToken;
    if (!instances.has(container)) {
      if (
        mountToken === mountState.lifecycleToken &&
        container.isConnected &&
        isActiveHomeContainer(container) &&
        !(config.hideOnTvLayout && isTvLayout()) &&
        canAttemptMount()
      )
        recordMountFailure();
      removePlaceholder(container);
      container.closest('#homeTab')?.classList.remove('featured-hero-page');
    }
    pendingContainers.delete(container);
    container.removeAttribute('data-featured-loading');
    if (lifecycleChanged && container.isConnected && isActiveHomeContainer(container)) scheduleScan();
  }
}

function scan(removeInactive = false): void {
  for (const [container, placeholder] of placeholders) {
    if (!container.isConnected || !placeholder.isConnected) {
      placeholder.remove();
      placeholders.delete(container);
      container.closest('#homeTab')?.classList.remove('featured-hero-page', 'featured-bootstrap-hero-page');
    }
  }
  for (const [container, instance] of instances) {
    const rootWasUnexpectedlyRemoved =
      container.isConnected && isActiveHomeContainer(container) && !instance.root.isConnected;
    if (!container.isConnected || !instance.root.isConnected || (removeInactive && !isActiveHomeContainer(container))) {
      if (rootWasUnexpectedlyRemoved) recordMountFailure();
      instance.destroy();
      instances.delete(container);
      container.closest('#homeTab')?.classList.remove('featured-hero-page', 'featured-bootstrap-hero-page');
    }
  }
  document.querySelectorAll(HOME_SELECTOR).forEach((container) => {
    if (!isActiveHomeContainer(container)) return;
    const instance = instances.get(container);
    const placeholder = placeholders.get(container);
    container.querySelectorAll(':scope > .featured-root').forEach((root) => {
      if (root !== instance?.root && root !== placeholder) root.remove();
    });
    void mount(container);
  });
}

function scheduleScan(removeInactive = false): void {
  runtimeCoordinator.scheduleScan(removeInactive);
}

function scheduleFullRefresh(): void {
  scheduleScan(true);
  scheduleAdminNavigationRefresh();
}

function mutationAddsAdminNavigation(mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') return false;
  return Array.from(mutation.addedNodes).some(
    (node) =>
      node instanceof Element &&
      (node.matches('ul[aria-labelledby="plugins-subheader"]') ||
        node.querySelector('ul[aria-labelledby="plugins-subheader"]') !== null ||
        isUserSettingsMenu(node) ||
        Array.from(node.querySelectorAll('ul[role="menu"]')).some(isUserSettingsMenu) ||
        node.matches('#myPreferencesMenuPage') ||
        node.querySelector('#myPreferencesMenuPage') !== null)
  );
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

export function start(): void {
  if (runtimeCoordinator.isStarted) return;
  window.JellyfinFeaturedBootstrap?.stop();
  mountState.beginLifecycle();
  runtimeCoordinator.start(document.getElementById('reactRoot') ?? document.body);
  document.addEventListener(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange);
  scheduleFullRefresh();
}

function handleMutations(mutations: MutationRecord[]): void {
  const hasTrackedMount = mountState.hasTrackedMount();
  if (shouldScheduleRuntimeScan(mutations, hasTrackedMount, trackedMountNeedsRecovery())) scheduleScan();
  if (mutations.some(mutationAddsAdminNavigation)) scheduleAdminNavigationRefresh();
}

export function destroy(): void {
  mountState.beginLifecycle();
  runtimeCoordinator.stop();
  document.removeEventListener(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange);
  cancelAdminNavigationRefresh();
  mountState.clear((instance) => instance.destroy());
  document.querySelectorAll('[data-featured-loading]').forEach((element) => {
    element.removeAttribute('data-featured-loading');
  });
  document.querySelectorAll('.featured-root').forEach((element) => element.remove());
  document
    .querySelectorAll('#homeTab.featured-hero-page')
    .forEach((element) => element.classList.remove('featured-hero-page'));
}

export function refresh(): void {
  destroy();
  start();
}
