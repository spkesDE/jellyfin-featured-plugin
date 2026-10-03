const CONTENT_FIT_MEDIA_QUERY = '(min-width: 701px)';
const HERO_CONTENT_GAP_PX = 12;
const OVERFLOW_TOLERANCE_PX = 1;
const OVERVIEW_FIT_CLASSES = [
  'featured-overview-lines-3',
  'featured-overview-lines-2',
  'featured-overview-lines-1',
  'featured-overview-hidden'
] as const;

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
  const paddingBottom = Number.parseFloat(getComputedStyle(content).paddingBottom) || 0;
  const contentBoxBottom = contentBottom - paddingBottom;
  const root = content.closest<HTMLElement>('.featured-root.featured-ready');
  if (!root?.classList.contains('featured-hero')) return contentBoxBottom;
  const nextSection = root.nextElementSibling;
  if (!(nextSection instanceof HTMLElement)) return contentBoxBottom;
  return Math.min(contentBoxBottom, nextSection.getBoundingClientRect().top - HERO_CONTENT_GAP_PX);
}

function getDefaultOverviewLines(content: HTMLElement): 2 | 3 | 4 {
  const root = content.closest<HTMLElement>('.featured-root.featured-ready');
  if (root?.classList.contains('featured-hero')) return 4;
  if (root?.classList.contains('featured-height-compact')) return 2;
  return 3;
}

export function fitFeaturedOverview(content: HTMLElement): number {
  clearOverviewFitClasses(content);
  if (!window.matchMedia(CONTENT_FIT_MEDIA_QUERY).matches) return 0;

  const overview = content.querySelector<HTMLElement>('.featured-overview');
  if (!overview || content.clientHeight <= 0) return 0;

  const fits = (): boolean =>
    getVisibleContentBottom(content) <= getAvailableContentBottom(content) + OVERFLOW_TOLERANCE_PX;

  const defaultLines = getDefaultOverviewLines(content);
  if (fits()) return defaultLines;

  for (const lines of [3, 2, 1] as const) {
    if (lines >= defaultLines) continue;
    const className = `featured-overview-lines-${lines}`;
    content.classList.add(className);
    if (fits()) return lines;
    content.classList.remove(className);
  }

  content.classList.add('featured-overview-hidden');
  return 0;
}

/** Keeps the active slide copy fitted as fonts, artwork, and viewport dimensions settle. */
export class OverviewFitGuard {
  private frame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private started = false;
  private destroyed = false;

  constructor(private readonly getActiveContent: () => HTMLElement | null) {}

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    window.addEventListener('resize', this.schedule);
    document.addEventListener('load', this.schedule, true);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.schedule);
      this.observeActiveContent();
    }
    if (document.fonts) void document.fonts.ready.then(this.schedule);
    this.schedule();
  }

  activeContentChanged(): void {
    if (!this.started) return;
    this.observeActiveContent();
    this.schedule();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('resize', this.schedule);
    document.removeEventListener('load', this.schedule, true);
    this.resizeObserver?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private schedule = (): void => {
    if (!this.started || this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const content = this.getActiveContent();
      if (content?.isConnected) fitFeaturedOverview(content);
    });
  };

  private observeActiveContent(): void {
    this.resizeObserver?.disconnect();
    const content = this.getActiveContent();
    if (!content) return;
    this.resizeObserver?.observe(content);
    Array.from(content.children).forEach((child) => this.resizeObserver?.observe(child));
  }
}
