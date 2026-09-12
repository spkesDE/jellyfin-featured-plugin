import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { t } from '../i18n';
import { CONSOLE_PREFIX, PLUGIN_VERSION } from '../constants';
import { createSlide, loadSlideArtwork } from './render';
import { trailerUrl } from './trailer';
import { applyHeroLayoutVariables } from './layout';

export type FeaturedItemLoader = (excludedItemIds: readonly string[]) => Promise<FeaturedResponse>;
export type FeaturedItemDisplayReporter = (itemId: string) => Promise<unknown>;

const MAX_DOM_SLIDES = 20;
const MAX_CACHED_ITEMS = 100;
const MAX_SEEN_ITEM_IDS = 500;

export class FeaturedCarousel {
  readonly root: HTMLElement;
  private readonly response: FeaturedResponse;
  private readonly items: FeaturedItem[];
  private readonly loadItems?: FeaturedItemLoader;
  private readonly reportDisplayed?: FeaturedItemDisplayReporter;
  private readonly seenItemIds: Set<string>;
  private readonly track: HTMLElement;
  private slides: HTMLElement[];
  private index = 0;
  private windowStart = 0;
  private discardedItemCount = 0;
  private hasMore: boolean;
  private loadingMore: Promise<void> | null = null;
  private pendingIndex: number | null = null;
  private timer: number | null = null;
  private autoplayEnabled: boolean;
  private touchStartX: number | null = null;
  private status: HTMLElement | null = null;
  private autoplayButton: HTMLButtonElement | null = null;
  private dots: HTMLButtonElement[] = [];
  private destroyed = false;
  private lastReportedItemId: string | null = null;

  constructor(response: FeaturedResponse, loadItems?: FeaturedItemLoader, reportDisplayed?: FeaturedItemDisplayReporter) {
    this.response = response;
    this.items = [...response.items];
    this.loadItems = loadItems;
    this.reportDisplayed = reportDisplayed;
    this.seenItemIds = new Set(this.items.map((item) => item.id));
    this.hasMore = response.infiniteLoading && response.hasMore;
    this.autoplayEnabled = response.autoplay;
    this.root = document.createElement('section');
    this.root.className = `ec-root ec-ready ec-effect-${response.transitionEffect} ec-height-${response.heroHeightMode} ec-text-${response.heroTextPosition}${response.useHeroLayout ? ' ec-hero' : ''}`;
    this.root.dataset.featuredVersion = PLUGIN_VERSION;
    applyHeroLayoutVariables(this.root, response);
    this.root.setAttribute('aria-roledescription', 'carousel');
    this.root.setAttribute('aria-label', response.heading || t('carousel.label'));

    if (response.heading && !response.useHeroLayout) {
      const heading = document.createElement('h2');
      heading.className = 'sectionTitle sectionTitle-cards ec-heading';
      heading.textContent = response.heading;
      this.root.appendChild(heading);
    }

    const viewport = document.createElement('div');
    viewport.className = 'ec-viewport';
    this.track = document.createElement('div');
    this.track.className = 'ec-track';
    this.slides = this.items.map((item) => createSlide(item, response));
    this.slides.forEach((slide) => this.track.appendChild(slide));
    viewport.appendChild(this.track);
    this.root.appendChild(viewport);

    const navigation = document.createElement('div');
    navigation.className = 'ec-navigation';

    const controls = document.createElement('div');
    controls.className = 'ec-controls';
    if (response.showSlidePosition && !response.showPaginationDots && !response.infiniteLoading && this.slides.length > 1) {
      this.status = document.createElement('div');
      this.status.className = 'ec-status';
      this.status.setAttribute('aria-live', 'polite');
      controls.appendChild(this.status);
    }

    if (response.showNavigationArrows && this.slides.length > 1) {
      controls.appendChild(this.createArrow('prev'));
    }
    if (response.autoplay && response.showAutoplayButton && this.slides.length > 1) {
      this.autoplayButton = document.createElement('button');
      this.autoplayButton.type = 'button';
      this.autoplayButton.className = 'ec-control ec-autoplay emby-scrollbuttons-button paper-icon-button-light';
      this.autoplayButton.addEventListener('click', () => {
        this.autoplayEnabled = !this.autoplayEnabled;
        this.updateAutoplayButton();
        this.restartTimer();
      });
      controls.appendChild(this.autoplayButton);
    }
    if (response.showNavigationArrows && this.slides.length > 1) {
      controls.appendChild(this.createArrow('next'));
    }
    if (controls.childElementCount) navigation.appendChild(controls);

    if (response.showPaginationDots && !response.infiniteLoading && this.slides.length > 1) {
      const dots = document.createElement('div');
      dots.className = 'ec-dots';
      this.dots = this.slides.map((_, dotIndex) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'ec-dot';
        dot.setAttribute('aria-label', `${dotIndex + 1} / ${this.slides.length}`);
        dot.addEventListener('click', () => this.show(dotIndex));
        dots.appendChild(dot);
        return dot;
      });
      navigation.appendChild(dots);
    }
    if (navigation.childElementCount) this.root.appendChild(navigation);

    this.root.addEventListener('mouseenter', this.pauseTimer);
    this.root.addEventListener('mouseleave', this.restartTimer);
    this.root.addEventListener('focusin', this.pauseTimer);
    this.root.addEventListener('focusout', this.restartTimer);
    this.root.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.root.addEventListener('touchend', this.onTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.show(0, false);
    this.updateAutoplayButton();
    this.restartTimer();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pauseTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopTrailer(this.slides[this.index - this.windowStart]);
    this.root.remove();
  }

  private createArrow(direction: 'prev' | 'next'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ec-control ec-arrow ec-arrow-${direction} emby-scrollbuttons-button paper-icon-button-light`;
    const icon = document.createElement('span');
    icon.className = `material-icons ${direction === 'prev' ? 'chevron_left' : 'chevron_right'}`;
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    button.setAttribute('aria-label', direction === 'prev' ? t('carousel.previous') : t('carousel.next'));
    button.addEventListener('click', () => this.show(this.index + (direction === 'prev' ? -1 : 1)));
    return button;
  }

  private show(nextIndex: number, restart = true): void {
    if (!this.slides.length) return;
    const previous = this.index;

    if (this.response.infiniteLoading) {
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= this.items.length) {
        if (this.hasMore) {
          this.pendingIndex = nextIndex;
          void this.loadMore();
        }
        return;
      }
      this.index = nextIndex;
      this.ensureIndexIsRendered();
    } else {
      this.index = (nextIndex + this.slides.length) % this.slides.length;
    }

    const localIndex = this.index - this.windowStart;
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
        slide.classList.add('ec-no-transition');
        wrappedSlides.push(slide);
      }
      const isActive = slideIndex === localIndex;
      if (previousOffset !== offset) {
        slide.dataset.ecOffset = String(offset);
        slide.style.setProperty('--ec-offset', `${offset * 100}%`);
      }
      if (slide.classList.contains('is-active') !== isActive) slide.classList.toggle('is-active', isActive);
      const ariaHidden = isActive ? 'false' : 'true';
      if (slide.getAttribute('aria-hidden') !== ariaHidden) slide.setAttribute('aria-hidden', ariaHidden);
      const tabIndex = isActive ? 0 : -1;
      if (slide.tabIndex !== tabIndex) slide.tabIndex = tabIndex;
    });
    if (wrappedSlides.length) {
      void this.root.offsetWidth;
      wrappedSlides.forEach((slide) => slide.classList.remove('ec-no-transition'));
    }
    if (this.status) {
      const absolutePosition = this.discardedItemCount + this.index + 1;
      this.status.textContent = `${absolutePosition} / ${this.discardedItemCount + this.items.length}`;
    }
    if (previous !== this.index) {
      this.dots[previous]?.classList.remove('is-active');
      this.dots[this.index]?.classList.add('is-active');
      this.stopTrailer(this.slides[previous - this.windowStart]);
    } else {
      this.dots[this.index]?.classList.add('is-active');
    }
    this.loadNearbyArtwork(localIndex);
    this.startTrailer(this.slides[localIndex], this.items[this.index]);
    this.reportActiveItem();
    if (this.shouldPrefetchNextBatch()) void this.loadMore();
    if (restart) this.restartTimer();
  }

  private loadNearbyArtwork(localIndex: number): void {
    const indexes = this.response.infiniteLoading
      ? [localIndex - 1, localIndex, localIndex + 1]
      : [
          (localIndex - 1 + this.slides.length) % this.slides.length,
          localIndex,
          (localIndex + 1) % this.slides.length
        ];
    new Set(indexes).forEach((index) => {
      const slide = this.slides[index];
      if (slide) loadSlideArtwork(slide);
    });
  }

  private shouldPrefetchNextBatch(): boolean {
    if (!this.response.infiniteLoading || !this.hasMore || !this.loadItems || this.destroyed) return false;
    const prefetchDistance = Math.max(1, this.response.batchSize);
    return this.items.length - this.index <= prefetchDistance;
  }

  private reportActiveItem(): void {
    const itemId = this.items[this.index]?.id;
    if (!itemId || itemId === this.lastReportedItemId || !this.reportDisplayed) return;
    this.lastReportedItemId = itemId;
    void this.reportDisplayed(itemId).catch((error) => {
      console.warn(`${CONSOLE_PREFIX} Could not record the displayed item.`, error);
    });
  }

  private ensureIndexIsRendered(): void {
    const renderedEnd = this.windowStart + this.slides.length;
    if (this.index >= this.windowStart && this.index < renderedEnd) return;

    const batchSize = Math.max(1, this.response.batchSize);
    const maximumStart = Math.max(0, this.items.length - MAX_DOM_SLIDES);
    const desiredStart = this.index < this.windowStart
      ? Math.max(0, this.index - batchSize + 1)
      : Math.max(0, this.index - MAX_DOM_SLIDES + batchSize);
    this.renderWindow(Math.min(maximumStart, desiredStart));
  }

  private renderWindow(start: number): void {
    this.stopTrailer(this.slides[this.index - this.windowStart]);
    this.track.replaceChildren();
    this.windowStart = start;
    this.slides = this.items
      .slice(start, start + MAX_DOM_SLIDES)
      .map((item) => createSlide(item, this.response));
    this.slides.forEach((slide) => this.track.appendChild(slide));
  }

  private appendNewlyVisibleSlides(): void {
    const desiredCount = Math.min(MAX_DOM_SLIDES, this.items.length - this.windowStart);
    for (let localIndex = this.slides.length; localIndex < desiredCount; localIndex += 1) {
      const item = this.items[this.windowStart + localIndex];
      if (!item) break;
      const slide = createSlide(item, this.response);
      this.slides.push(slide);
      this.track.appendChild(slide);
    }
  }

  private loadMore(): Promise<void> {
    if (this.loadingMore) return this.loadingMore;
    if (!this.hasMore || !this.loadItems || this.destroyed) return Promise.resolve();

    this.loadingMore = this.loadItems([...this.seenItemIds])
      .then((response) => {
        if (this.destroyed) return;
        const newItems = (response.items ?? []).filter((item) => !this.seenItemIds.has(item.id));
        newItems.forEach((item) => {
          this.seenItemIds.add(item.id);
          this.items.push(item);
        });
        this.hasMore = response.hasMore && newItems.length > 0;
        while (this.seenItemIds.size > MAX_SEEN_ITEM_IDS) {
          const oldestId = this.seenItemIds.values().next().value;
          if (!oldestId) break;
          this.seenItemIds.delete(oldestId);
        }
        this.trimItemCache();
        this.appendNewlyVisibleSlides();

        const pendingIndex = this.pendingIndex;
        this.pendingIndex = null;
        if (pendingIndex !== null && pendingIndex < this.items.length) this.show(pendingIndex, false);
        else this.show(this.index, false);
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
    const removeCount = this.items.length - MAX_CACHED_ITEMS;
    if (removeCount <= 0 || this.index < removeCount || this.windowStart < removeCount) return;

    this.items.splice(0, removeCount);
    this.index -= removeCount;
    this.windowStart -= removeCount;
    this.discardedItemCount += removeCount;
    if (this.pendingIndex !== null) this.pendingIndex = Math.max(0, this.pendingIndex - removeCount);
  }

  private startTrailer(slide: HTMLElement, item: FeaturedItem): void {
    if (!this.response.enableBackgroundTrailers || !item.localTrailerId || document.hidden) return;
    let video = slide.querySelector<HTMLVideoElement>('.ec-trailer');
    if (!video) {
      const url = trailerUrl(item.localTrailerId);
      if (!url) return;
      video = document.createElement('video');
      video.className = 'ec-trailer';
      video.src = url;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      slide.querySelector('.ec-backdrop')?.after(video);
    }
    void video.play().catch(() => undefined);
  }

  private stopTrailer(slide?: HTMLElement): void {
    const video = slide?.querySelector<HTMLVideoElement>('.ec-trailer');
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }

  private pauseTimer = (): void => {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  };

  private restartTimer = (): void => {
    this.pauseTimer();
    if (!this.autoplayEnabled || this.slides.length < 2 || document.hidden || this.destroyed) return;
    this.timer = window.setInterval(() => this.show(this.index + 1, false), Math.max(1000, this.response.autoplayInterval));
  };

  private updateAutoplayButton(): void {
    if (!this.autoplayButton) return;
    let icon = this.autoplayButton.querySelector<HTMLElement>('.material-icons');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.setAttribute('aria-hidden', 'true');
      this.autoplayButton.appendChild(icon);
    }
    icon.className = `material-icons ${this.autoplayEnabled ? 'pause' : 'play_arrow'}`;
    this.autoplayButton.setAttribute(
      'aria-label',
      this.autoplayEnabled ? t('carousel.pauseAutoplay') : t('carousel.startAutoplay')
    );
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    this.show(this.index + (event.key === 'ArrowLeft' ? -1 : 1));
  };

  private onTouchStart = (event: TouchEvent): void => {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (this.touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(delta) >= 45) this.show(this.index + (delta < 0 ? 1 : -1));
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseTimer();
      this.stopTrailer(this.slides[this.index - this.windowStart]);
    } else {
      this.startTrailer(this.slides[this.index - this.windowStart], this.items[this.index]);
      this.restartTimer();
    }
  };
}
