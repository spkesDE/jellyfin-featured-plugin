const HOME_SURFACE_SELECTOR = '#indexPage, #homeTab, .homeSectionsContainer';
const PLUGIN_SURFACE_SELECTOR = '.featured-root, .featured-bootstrap-placeholder';

export function shouldScheduleRuntimeScan(
  mutations: MutationRecord[],
  hasTrackedMount: boolean,
  trackedMountNeedsRecovery: boolean
): boolean {
  return trackedMountNeedsRecovery || (!hasTrackedMount && mutations.some(mutationAffectsHome));
}

function mutationAffectsHome(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  if (!target || target.closest(PLUGIN_SURFACE_SELECTOR)) return false;
  if (mutation.type === 'attributes') return target.matches('#indexPage, #homeTab, .page');

  const changedElements = [...mutation.addedNodes, ...mutation.removedNodes].filter(
    (node): node is Element => node instanceof Element
  );
  if (!changedElements.length) return false;
  if (changedElements.every(isPluginElement)) return false;
  if (target.closest(HOME_SURFACE_SELECTOR)) return true;
  return changedElements.some(elementContainsHomeSurface);
}

function elementContainsHomeSurface(element: Element): boolean {
  return element.matches(HOME_SURFACE_SELECTOR) || element.querySelector(HOME_SURFACE_SELECTOR) !== null;
}

function isPluginElement(element: Element): boolean {
  return element.matches(PLUGIN_SURFACE_SELECTOR) || element.closest(PLUGIN_SURFACE_SELECTOR) !== null;
}
