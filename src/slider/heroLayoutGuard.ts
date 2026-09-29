import { calculateHeroClearance } from './layout';

/**
 * Keeps hero text clear of the following Jellyfin section. The guard owns every
 * observer/listener it creates, so carousel teardown cannot leave layout work behind.
 */
export class HeroLayoutGuard {
  private frame: number | null = null;
  private verificationPasses = 0;
  private contentObserver: ResizeObserver | null = null;
  private parentObserver: MutationObserver | null = null;
  private started = false;
  private destroyed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly getActiveContent: () => Element | null
  ) {}

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    window.addEventListener('resize', this.schedule);
    this.root.addEventListener('load', this.schedule, true);
    if (typeof ResizeObserver !== 'undefined') {
      this.contentObserver = new ResizeObserver(this.schedule);
      this.observeActiveContent();
    }
    if (this.root.parentElement) {
      this.parentObserver = new MutationObserver(this.schedule);
      this.parentObserver.observe(this.root.parentElement, { childList: true });
    }
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
    this.root.removeEventListener('load', this.schedule, true);
    this.contentObserver?.disconnect();
    this.parentObserver?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private schedule = (): void => {
    this.verificationPasses = 0;
    this.queueUpdate();
  };

  private queueUpdate(): void {
    if (!this.started || this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.updateClearance();
    });
  }

  private observeActiveContent(): void {
    this.contentObserver?.disconnect();
    const content = this.getActiveContent();
    if (!content) return;
    this.contentObserver?.observe(content);
    Array.from(content.children).forEach((child) => this.contentObserver?.observe(child));
  }

  private updateClearance(): void {
    if (!this.root.isConnected) return;
    const section = this.root.nextElementSibling;
    const content = this.getActiveContent();
    if (!section || !content) return;
    const visibleChildren = Array.from(content.children).filter((child) => child.getClientRects().length);
    if (!visibleChildren.length) return;

    const contentBottom = Math.max(...visibleChildren.map((child) => child.getBoundingClientRect().bottom));
    const sectionTop = section.getBoundingClientRect().top;
    const current = Number.parseFloat(this.root.style.getPropertyValue('--featured-content-clearance')) || 0;
    const clearance = calculateHeroClearance(current, contentBottom, sectionTop);
    if (Math.abs(clearance - current) < 1) return;
    if (clearance) this.root.style.setProperty('--featured-content-clearance', `${clearance}px`);
    else this.root.style.removeProperty('--featured-content-clearance');
    if (this.verificationPasses < 2) {
      this.verificationPasses += 1;
      this.queueUpdate();
    }
  }
}
