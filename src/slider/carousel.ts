import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { t } from '../i18n';
import { CONSOLE_PREFIX, PLUGIN_VERSION } from '../constants';
import { createSlide, loadSlideArtwork } from './render';
import { applyHeroLayoutVariables } from './layout';
import { replaceElementChildren } from '../core/dom';
import { HeroLayoutGuard } from './heroLayoutGuard';
import { TrailerController } from './trailerController';
import { CarouselWindowModel } from './carouselWindow';
import {
  createAutoplayControl,
  createCarouselArrow,
  createCarouselStatus,
  createPaginationDots,
  updateAutoplayControl
} from './carouselControls';

type FeaturedItemLoader = (excludedItemIds: readonly string[]) => Promise<FeaturedResponse>;
type FeaturedItemDisplayReporter = (itemId: string) => Promise<unknown>;

const MAX_DOM_SLIDES = 20;
const MAX_CACHED_ITEMS = 100;
const MAX_SEEN_ITEM_IDS = 500;
export class FeaturedCarousel {
  readonly root: HTMLElement;
  private readonly response: FeaturedResponse;
  private readonly items: FeaturedItem[];
  private readonly loadItems?: FeaturedItemLoader;
  private readonly reportDisplayed?: FeaturedItemDisplayReporter;
  private readonly window: CarouselWindowModel;
  private readonly track: HTMLElement;
  private slides: HTMLElement[];
  private loadingMore: Promise<void> | null = null;
  private timer: number | null = null;
  private autoplayEnabled: boolean;
  private touchStart: { x: number; y: number } | null = null;
  private suppressClickUntil = 0;
  private status: HTMLElement | null = null;
  private autoplayButton: HTMLButtonElement | null = null;
  private dots: HTMLButtonElement[] = [];
  private destroyed = false;
  private lastReportedItemId: string | null = null;
  private readonly trailerController: TrailerController;
  private readonly heroLayoutGuard: HeroLayoutGuard | null;

  constructor(
    response: FeaturedResponse,
    loadItems?: FeaturedItemLoader,
    reportDisplayed?: FeaturedItemDisplayReporter,
    alreadyDisplayedItemId?: string
  ) {
    this.response = response;
    this.items = [...response.items];
    this.loadItems = loadItems;
    this.reportDisplayed = reportDisplayed;
    this.lastReportedItemId = alreadyDisplayedItemId ?? null;
    this.window = new CarouselWindowModel(
      this.items.map((item) => item.id),
      response.infiniteLoading && response.hasMore
    );
    this.autoplayEnabled = response.autoplay;
    this.root = document.createElement('section');
    this.root.className = `featured-root featured-ready featured-effect-${response.transitionEffect} featured-height-${response.heroHeightMode} featured-text-${response.heroTextPosition}${response.useHeroLayout ? ' featured-hero' : ''}${response.showControlsOnHoverOnly ? ' featured-controls-hover' : ''}${response.interactOnWholeBanner ? ' featured-whole-banner-interactive' : ''}`;
    this.root.dataset.featuredVersion = PLUGIN_VERSION;
    applyHeroLayoutVariables(this.root, response);
    this.root.setAttribute('aria-roledescription', 'carousel');
    this.root.setAttribute('aria-label', response.heading || t('carousel.label'));

    if (response.heading && !response.useHeroLayout) {
      const heading = document.createElement('h2');
      heading.className = 'sectionTitle sectionTitle-cards featured-heading';
      heading.textContent = response.heading;
      this.root.appendChild(heading);
    }

    const viewport = document.createElement('div');
    viewport.className = 'featured-viewport';
    this.track = document.createElement('div');
    this.track.className = 'featured-track';
    this.slides = this.items.map((item) => createSlide(item, response));
    this.slides.forEach((slide) => this.track.appendChild(slide));
    viewport.appendChild(this.track);
    this.root.appendChild(viewport);
    this.heroLayoutGuard = response.useHeroLayout
      ? new HeroLayoutGuard(
          this.root,
          () => this.slides[this.window.index - this.window.windowStart]?.querySelector('.featured-content') ?? null
        )
      : null;

    const navigation = document.createElement('div');
    navigation.className = 'featured-navigation';

    const controls = document.createElement('div');
    let autoplayCountdownProgress: SVGCircleElement | null = null;
    controls.className = 'featured-controls';
    if (
      response.showSlidePosition &&
      !response.showPaginationDots &&
      !response.infiniteLoading &&
      this.slides.length > 1
    ) {
      this.status = createCarouselStatus();
      controls.appendChild(this.status);
    }

    if (response.showNavigationArrows && this.slides.length > 1) {
      controls.appendChild(createCarouselArrow('prev', (offset) => this.activateSlide(this.window.index + offset)));
    }
    if (response.autoplay && response.showAutoplayButton && this.slides.length > 1) {
      const autoplay = createAutoplayControl(() => {
        this.autoplayEnabled = !this.autoplayEnabled;
        this.updateAutoplayButton();
        this.restartTimer();
      });
      this.autoplayButton = autoplay.button;
      autoplayCountdownProgress = autoplay.countdownProgress;
      controls.appendChild(this.autoplayButton);
    }
    if (response.showNavigationArrows && this.slides.length > 1) {
      controls.appendChild(createCarouselArrow('next', (offset) => this.activateSlide(this.window.index + offset)));
    }
    if (controls.childElementCount) navigation.appendChild(controls);

    this.trailerController = new TrailerController(
      response,
      this.items.some((item) => item.trailer || item.trailers?.length),
      this.autoplayButton,
      autoplayCountdownProgress,
      {
        getActiveIndex: () => this.window.index,
        isDestroyed: () => this.destroyed,
        isAutoplayEnabled: () => this.autoplayEnabled,
        advance: () => this.activateSlide(this.window.index + 1, false),
        pauseAutoplay: this.pauseTimer,
        restartAutoplay: this.restartTimer
      }
    );

    if (response.showPaginationDots && !response.infiniteLoading && this.slides.length > 1) {
      const pagination = createPaginationDots(this.slides.length, (index) => this.activateSlide(index));
      this.dots = pagination.buttons;
      navigation.appendChild(pagination.root);
    }
    if (this.trailerController.controls) navigation.appendChild(this.trailerController.controls);
    if (navigation.childElementCount) this.root.appendChild(navigation);

    this.root.addEventListener('mouseenter', this.pauseTimer);
    this.root.addEventListener('mouseleave', this.restartTimer);
    this.root.addEventListener('focusin', this.pauseTimer);
    this.root.addEventListener('focusout', this.restartTimer);
    this.root.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.root.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.root.addEventListener('touchcancel', this.onTouchCancel, { passive: true });
    this.root.addEventListener('click', this.onClickAfterSwipe, true);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.activateSlide(0, false);
    this.updateAutoplayButton();
    this.restartTimer();
  }

  getActiveItem(): FeaturedItem | undefined {
    return this.items[this.window.index];
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pauseTimer();
    this.heroLayoutGuard?.destroy();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.trailerController.destroy();
    this.root.remove();
  }

  /** Start after insertion so the following Jellyfin section can be measured. */
  startHeroLayoutGuard(): void {
    this.heroLayoutGuard?.start();
  }

  private activateSlide(nextIndex: number, restart = true): void {
    if (!this.slides.length) return;
    const previous = this.window.index;
    const activeSlide = this.slides[previous - this.window.windowStart];
    const focusedElement = document.activeElement;
    const focusedActionIndex =
      activeSlide && focusedElement instanceof HTMLButtonElement
        ? Array.from(activeSlide.querySelectorAll<HTMLButtonElement>('.featured-actions button')).indexOf(
            focusedElement
          )
        : -1;
    const focusedBanner = focusedElement === activeSlide;

    if (!this.window.activate(nextIndex, this.items.length, this.slides.length, this.response.infiniteLoading)) {
      if (this.window.hasMore) void this.loadMore();
      return;
    }
    if (this.response.infiniteLoading) this.ensureIndexIsRendered();

    const localIndex = this.window.index - this.window.windowStart;
    const wrappedSlides: HTMLElement[] = [];
    this.slides.forEach((slide, slideIndex) => {
      let offset = slideIndex - localIndex;
      if (!this.response.infiniteLoading) {
        if (offset > this.slides.length / 2) offset -= this.slides.length;
        if (offset < -this.slides.length / 2) offset += this.slides.length;
      }
      offset = Math.sign(offset);
      const previousOffset = Number(slide.dataset.ecOffset);
      if (Number.isFinite(previousOffset) && Math.abs(previousOffset - offset) > 1) {
        slide.classList.add('featured-no-transition');
        wrappedSlides.push(slide);
      }
      const isActive = slideIndex === localIndex;
      if (previousOffset !== offset) {
        slide.dataset.ecOffset = String(offset);
        slide.style.setProperty('--featured-offset', `${offset * 100}%`);
      }
      if (slide.classList.contains('is-active') !== isActive) slide.classList.toggle('is-active', isActive);
      const ariaHidden = isActive ? 'false' : 'true';
      if (slide.getAttribute('aria-hidden') !== ariaHidden) slide.setAttribute('aria-hidden', ariaHidden);
      const tabIndex = isActive && this.response.interactOnWholeBanner ? 0 : -1;
      if (slide.tabIndex !== tabIndex) slide.tabIndex = tabIndex;
      slide.querySelectorAll<HTMLButtonElement>('.featured-actions button').forEach((button) => {
        const actionTabIndex = isActive ? 0 : -1;
        if (button.tabIndex !== actionTabIndex) button.tabIndex = actionTabIndex;
      });
    });
    if (previous !== this.window.index && (focusedBanner || focusedActionIndex >= 0)) {
      const nextSlide = this.slides[localIndex];
      const nextAction =
        focusedActionIndex >= 0
          ? nextSlide?.querySelectorAll<HTMLButtonElement>('.featured-actions button')[focusedActionIndex]
          : null;
      if (nextAction) nextAction.focus();
      else if (this.response.interactOnWholeBanner) nextSlide?.focus();
      else nextSlide?.querySelector<HTMLButtonElement>('.featured-actions button')?.focus();
    }
    if (wrappedSlides.length) {
      void this.root.offsetWidth;
      wrappedSlides.forEach((slide) => slide.classList.remove('featured-no-transition'));
    }
    if (this.status) {
      const absolutePosition = this.window.discardedItemCount + this.window.index + 1;
      this.status.textContent = `${absolutePosition} / ${this.window.discardedItemCount + this.items.length}`;
    }
    if (previous !== this.window.index) {
      this.dots[previous]?.classList.remove('is-active');
      this.dots[this.window.index]?.classList.add('is-active');
      this.trailerController.stop();
    } else {
      this.dots[this.window.index]?.classList.add('is-active');
    }
    this.loadNearbyArtwork(localIndex);
    this.heroLayoutGuard?.activeContentChanged();
    this.trailerController.start(this.slides[localIndex], this.items[this.window.index]);
    this.reportActiveItem();
    if (this.shouldPrefetchNextBatch()) void this.loadMore();
    if (restart) this.restartTimer();
  }

  private loadNearbyArtwork(localIndex: number): void {
    const indexes = this.response.infiniteLoading
      ? [localIndex - 1, localIndex, localIndex + 1]
      : [(localIndex - 1 + this.slides.length) % this.slides.length, localIndex, (localIndex + 1) % this.slides.length];
    new Set(indexes).forEach((index) => {
      const slide = this.slides[index];
      if (slide) loadSlideArtwork(slide);
    });
  }

  private shouldPrefetchNextBatch(): boolean {
    if (!this.response.infiniteLoading || !this.loadItems || this.destroyed) return false;
    return this.window.shouldPrefetch(this.response.batchSize, this.items.length);
  }

  private reportActiveItem(): void {
    const itemId = this.items[this.window.index]?.id;
    if (!itemId || itemId === this.lastReportedItemId || !this.reportDisplayed) return;
    this.lastReportedItemId = itemId;
    void this.reportDisplayed(itemId).catch((error) => {
      console.warn(`${CONSOLE_PREFIX} Could not record the displayed item.`, error);
    });
  }

  private ensureIndexIsRendered(): void {
    if (this.window.isActiveIndexRendered(this.slides.length)) return;
    this.renderWindow(this.window.calculateWindowStart(this.items.length, this.response.batchSize, MAX_DOM_SLIDES));
  }

  private renderWindow(start: number): void {
    this.trailerController.stop();
    replaceElementChildren(this.track);
    this.window.setRenderedWindowStart(start);
    this.slides = this.items.slice(start, start + MAX_DOM_SLIDES).map((item) => createSlide(item, this.response));
    this.slides.forEach((slide) => this.track.appendChild(slide));
  }

  private appendNewlyVisibleSlides(): void {
    const desiredCount = Math.min(MAX_DOM_SLIDES, this.items.length - this.window.windowStart);
    for (let localIndex = this.slides.length; localIndex < desiredCount; localIndex += 1) {
      const item = this.items[this.window.windowStart + localIndex];
      if (!item) break;
      const slide = createSlide(item, this.response);
      this.slides.push(slide);
      this.track.appendChild(slide);
    }
  }

  private loadMore(): Promise<void> {
    if (this.loadingMore) return this.loadingMore;
    if (!this.window.hasMore || !this.loadItems || this.destroyed) return Promise.resolve();

    this.loadingMore = this.loadItems(this.window.getExcludedItemIds())
      .then((response) => {
        if (this.destroyed) return;
        const newItems = this.window.acceptBatch(response.items ?? [], response.hasMore, MAX_SEEN_ITEM_IDS);
        newItems.forEach((item) => {
          this.items.push(item);
        });
        this.trimItemCache();
        this.appendNewlyVisibleSlides();

        const pendingIndex = this.window.takePendingIndex();
        if (pendingIndex !== null && pendingIndex < this.items.length) this.activateSlide(pendingIndex, false);
        else this.activateSlide(this.window.index, false);
      })
      .catch((error) => {
        console.warn(`${CONSOLE_PREFIX} Could not load the next featured items.`, error);
      })
      .finally(() => {
        this.loadingMore = null;
      });
    return this.loadingMore;
  }

  private trimItemCache(): void {
    const removeCount = this.window.trimDiscardedPrefix(this.items.length, MAX_CACHED_ITEMS);
    if (removeCount <= 0) return;
    this.items.splice(0, removeCount);
  }

  private pauseTimer = (): void => {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  };

  private restartTimer = (): void => {
    this.pauseTimer();
    if (
      !this.autoplayEnabled ||
      this.slides.length < 2 ||
      document.hidden ||
      this.destroyed ||
      this.trailerController.isPaused ||
      this.root.contains(document.activeElement)
    )
      return;
    this.timer = window.setInterval(
      () => this.activateSlide(this.window.index + 1, false),
      Math.max(1000, this.response.autoplayInterval)
    );
  };

  private updateAutoplayButton(): void {
    if (!this.autoplayButton) return;
    updateAutoplayControl(this.autoplayButton, this.autoplayEnabled);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (
      event.target !== this.slides[this.window.index - this.window.windowStart] ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    this.activateSlide(this.window.index + (event.key === 'ArrowLeft' ? -1 : 1));
  };

  private onTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    this.touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (!this.touchStart) return;
    const touch = event.changedTouches[0];
    const deltaX = (touch?.clientX ?? this.touchStart.x) - this.touchStart.x;
    const deltaY = (touch?.clientY ?? this.touchStart.y) - this.touchStart.y;
    this.touchStart = null;
    if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      this.suppressClickUntil = performance.now() + 500;
      this.activateSlide(this.window.index + (deltaX < 0 ? 1 : -1));
    }
  };

  private onTouchCancel = (): void => {
    this.touchStart = null;
  };

  private onClickAfterSwipe = (event: MouseEvent): void => {
    if (performance.now() >= this.suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseTimer();
      this.trailerController.stop();
    } else {
      this.trailerController.start(
        this.slides[this.window.index - this.window.windowStart],
        this.items[this.window.index]
      );
      this.restartTimer();
    }
  };
}
