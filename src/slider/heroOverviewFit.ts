const HERO_FIT_MEDIA_QUERY = '(min-width: 701px)';
const HERO_CONTENT_SELECTOR = '.featured-root.featured-ready.featured-hero .featured-slide.is-active .featured-content';
const INSTALL_MARKER = 'data-jellyfin-featured-overview-fit';
const HERO_CONTENT_GAP_PX = 12;
const OVERFLOW_TOLERANCE_PX = 1;
const OVERVIEW_FIT_CLASSES = [
  'featured-overview-lines-3',
  'featured-overview-lines-2',
  'featured-overview-lines-1',
  'featured-overview-hidden'
] as const;

let scheduledFrame: number | null = null;

function clearOverviewFitClasses(content: HTMLElement): void {
  content.classList.remove(...OVERVIEW_FIT_CLASSES);
}

function getVisibleContentBottom(content: HTMLElement): number {
  const visibleChildren = Array.from(content.children).filter((child) => child.getClientRects().length > 0);
  if (!visibleChildren.length) return content.getBoundingClientRect().top;
  return Math.max(...visibleChildren.map((child) => child.getBoundingClientRect().bottom));
}

function getAvailableContentBottom(content: HTMLElement): number {
  const contentBottom = content.getBoundingClientRect().bottom;
  const root = content.closest<HTMLElement>('.featured-root.featured-ready.featured-hero');
  const nextSection = root?.nextElementSibling;
  if (!(nextSection instanceof HTMLElement)) return contentBottom;
  return Math.min(contentBottom, nextSection.getBoundingClientRect().top - HERO_CONTENT_GAP_PX);
}

export function fitHeroOverview(content: HTMLElement): number {
  clearOverviewFitClasses(content);
  if (!window.matchMedia(HERO_FIT_MEDIA_QUERY).matches) return 0;

  const overview = content.querySelector<HTMLElement>('.featured-overview');
  if (!overview || content.clientHeight <= 0) return 0;

  const fits = (): boolean =>
    getVisibleContentBottom(content) <= getAvailableContentBottom(content) + OVERFLOW_TOLERANCE_PX;

  if (fits()) return 4;

  for (const lines of [3, 2, 1] as const) {
    const className = `featured-overview-lines-${lines}`;
    content.classList.add(className);
    if (fits()) return lines;
    content.classList.remove(className);
  }

  content.classList.add('featured-overview-hidden');
  return 0;
}

function fitActiveHeroOverviews(): void {
  document.querySelectorAll<HTMLElement>(HERO_CONTENT_SELECTOR).forEach(fitHeroOverview);
}

function scheduleHeroOverviewFit(): void {
  if (scheduledFrame !== null) return;
  scheduledFrame = requestAnimationFrame(() => {
    scheduledFrame = null;
    fitActiveHeroOverviews();
  });
}

function mutationNeedsFit(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    return mutation.target instanceof HTMLElement && mutation.target.classList.contains('featured-slide');
  }

  if (mutation.type !== 'childList') return false;
  if (mutation.target instanceof Element && mutation.target.closest('.featured-root.featured-hero')) return true;

  return [...mutation.addedNodes, ...mutation.removedNodes].some(
    (node) =>
      node instanceof Element &&
      (node.matches('.featured-root.featured-hero') || node.querySelector('.featured-root.featured-hero') !== null)
  );
}

export function installAdaptiveHeroOverview(): void {
  const documentRoot = document.documentElement;
  if (documentRoot.hasAttribute(INSTALL_MARKER)) return;
  documentRoot.setAttribute(INSTALL_MARKER, '');

  const install = (): void => {
    const observationRoot = document.body ?? documentRoot;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(mutationNeedsFit)) scheduleHeroOverviewFit();
    });
    observer.observe(observationRoot, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', scheduleHeroOverviewFit);
    document.addEventListener('load', scheduleHeroOverviewFit, true);
    if (document.fonts) void document.fonts.ready.then(scheduleHeroOverviewFit);
    scheduleHeroOverviewFit();
  };

  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
}
