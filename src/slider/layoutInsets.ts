const HEADER_SELECTOR = '.skinHeader';
const SLOT_POSITION_PATTERN = /\bfeatured-control-slot-([a-z-]+)\b/;

/** Pixels of the Featured viewport that Jellyfin's header covers at scroll position zero. */
export function calculateHeaderOffset(headerBottom: number, viewportTop: number): number {
  return Math.max(0, Math.ceil(headerBottom - viewportTop));
}

/** Measures in document space so scrolling the page never changes the result. */
function getDocumentTop(element: Element): number {
  let top = element.getBoundingClientRect().top;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) top += parent.scrollTop;
  return top;
}

function getHeaderBottom(header: HTMLElement): number {
  if (!header.offsetHeight) return 0;
  // Jellyfin slides its fixed header away while scrolling. The layout box keeps
  // its place, so the measured offset stays stable instead of following it.
  if (getComputedStyle(header).position === 'fixed') return header.offsetTop + header.offsetHeight;
  return getDocumentTop(header) + header.offsetHeight;
}

/**
 * Publishes the space that Jellyfin's header and the carousel controls occupy as
 * CSS variables, so the text block can keep clear of both in every anchor.
 */
export class LayoutInsetGuard {
  private frame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private started = false;
  private destroyed = false;

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    window.addEventListener('resize', this.schedule);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.schedule);
      const header = document.querySelector(HEADER_SELECTOR);
      if (header) this.resizeObserver.observe(header);
      this.root
        .querySelectorAll('.featured-viewport, .featured-navigation, .featured-control-slot')
        .forEach((element) => this.resizeObserver?.observe(element));
    }
    this.schedule();
  }

  /** Slide changes are a cheap moment to catch page transforms applied after mount. */
  activeContentChanged(): void {
    this.schedule();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('resize', this.schedule);
    this.resizeObserver?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private schedule = (): void => {
    if (!this.started || this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  };

  private update(): void {
    if (!this.root.isConnected) return;
    const viewport = this.root.querySelector<HTMLElement>('.featured-viewport');
    if (!viewport) return;

    const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
    const headerOffset = header ? calculateHeaderOffset(getHeaderBottom(header), getDocumentTop(viewport)) : 0;
    this.setLength('--featured-header-offset', headerOffset);
    this.setLength('--featured-viewport-height', viewport.clientHeight);

    const navigation = this.root.classList.contains('featured-hero')
      ? this.root.querySelector<HTMLElement>('.featured-navigation')
      : null;
    this.setLength('--featured-navigation-width', navigation?.offsetWidth ?? 0);

    const slotSizes = new Map<string, { width: number; height: number }>();
    this.root.querySelectorAll<HTMLElement>('.featured-control-slot').forEach((slot) => {
      const position = SLOT_POSITION_PATTERN.exec(slot.className)?.[1];
      if (position) slotSizes.set(position, { width: slot.offsetWidth, height: slot.offsetHeight });
    });
    for (const position of ['bottom-center', 'top-right', 'center']) {
      const size = slotSizes.get(position);
      this.setLength(`--featured-slot-${position}-width`, size?.width ?? 0);
      this.setLength(`--featured-slot-${position}-height`, size?.height ?? 0);
    }
  }

  private setLength(name: string, value: number): void {
    const next = value > 0 ? `${Math.ceil(value)}px` : '';
    if (this.root.style.getPropertyValue(name) === next) return;
    if (next) this.root.style.setProperty(name, next);
    else this.root.style.removeProperty(name);
  }
}
