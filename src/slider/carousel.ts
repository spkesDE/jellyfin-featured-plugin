import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { t } from '../i18n';
import { CONSOLE_PREFIX, PLUGIN_VERSION } from '../constants';
import { createSlide, loadSlideArtwork } from './render';
import { createTrailerPlayer, isMobileTrailerClient, type TrailerPlayer } from './trailer';
import { applyHeroLayoutVariables, calculateHeroClearance } from './layout';
import { replaceElementChildren } from '../core/dom';

export type FeaturedItemLoader = (excludedItemIds: readonly string[]) => Promise<FeaturedResponse>;
export type FeaturedItemDisplayReporter = (itemId: string) => Promise<unknown>;

const MAX_DOM_SLIDES = 20;
const MAX_CACHED_ITEMS = 100;
const MAX_SEEN_ITEM_IDS = 500;
const YOUTUBE_CONTROL_CONCEALMENT_MS = 5000;
const TRAILER_VOLUME_STORAGE_KEY = 'jellyfin-featured.trailer-volume';
const DEFAULT_TRAILER_VOLUME = 100;

function readTrailerVolume(): number {
  try {
    const stored = window.localStorage.getItem(TRAILER_VOLUME_STORAGE_KEY);
    if (stored === null) return DEFAULT_TRAILER_VOLUME;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : DEFAULT_TRAILER_VOLUME;
  } catch {
    return DEFAULT_TRAILER_VOLUME;
  }
}

function saveTrailerVolume(volume: number): void {
  try {
    window.localStorage.setItem(TRAILER_VOLUME_STORAGE_KEY, String(volume));
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}

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
  private touchStart: { x: number; y: number } | null = null;
  private suppressClickUntil = 0;
  private hasLeftInitialSlide = false;
  private status: HTMLElement | null = null;
  private autoplayButton: HTMLButtonElement | null = null;
  private trailerCountdownProgress: SVGCircleElement | null = null;
  private trailerCountdownTimer: number | null = null;
  private dots: HTMLButtonElement[] = [];
  private destroyed = false;
  private lastReportedItemId: string | null = null;
  private trailerPlayer: TrailerPlayer | null = null;
  private trailerSlide: HTMLElement | null = null;
  private trailerDelayTimer: number | null = null;
  private trailerItemId: string | null = null;
  private trailerCandidateIndex = -1;
  private trailerMuted: boolean;
  private trailerVolume: number;
  private trailerPaused = false;
  private trailerConcealed = false;
  private heroLayoutGuardStarted = false;
  private heroLayoutFrame: number | null = null;
  private heroLayoutVerificationPasses = 0;
  private heroContentObserver: ResizeObserver | null = null;
  private heroParentObserver: MutationObserver | null = null;

  constructor(response: FeaturedResponse, loadItems?: FeaturedItemLoader, reportDisplayed?: FeaturedItemDisplayReporter) {
    this.response = response;
    this.items = [...response.items];
    this.loadItems = loadItems;
    this.reportDisplayed = reportDisplayed;
    this.seenItemIds = new Set(this.items.map((item) => item.id));
    this.hasMore = response.infiniteLoading && response.hasMore;
    this.autoplayEnabled = response.autoplay;
    this.trailerVolume = readTrailerVolume();
    // Honor the configured start state on every client. Browser autoplay policy
    // may still block unattended playback with sound until the user interacts.
    this.trailerMuted = response.startTrailersMuted || this.trailerVolume === 0;
    this.root = document.createElement('section');
    this.root.className = `ec-root ec-ready ec-effect-${response.transitionEffect} ec-height-${response.heroHeightMode} ec-text-${response.heroTextPosition}${response.useHeroLayout ? ' ec-hero' : ''}${response.showControlsOnHoverOnly ? ' ec-controls-hover' : ''}${response.interactOnWholeBanner ? ' ec-whole-banner-interactive' : ''}`;
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
      const countdownRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      countdownRing.classList.add('ec-countdown-ring');
      countdownRing.setAttribute('viewBox', '0 0 40 40');
      countdownRing.setAttribute('aria-hidden', 'true');
      const countdownTrack = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      countdownTrack.classList.add('ec-countdown-track');
      countdownTrack.setAttribute('cx', '20');
      countdownTrack.setAttribute('cy', '20');
      countdownTrack.setAttribute('r', '17');
      const countdownProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      countdownProgress.classList.add('ec-countdown-progress');
      countdownProgress.setAttribute('cx', '20');
      countdownProgress.setAttribute('cy', '20');
      countdownProgress.setAttribute('r', '17');
      countdownProgress.setAttribute('pathLength', '100');
      countdownRing.append(countdownTrack, countdownProgress);
      this.trailerCountdownProgress = countdownProgress;
      this.autoplayButton.appendChild(countdownRing);
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
    this.root.addEventListener('touchcancel', this.onTouchCancel, { passive: true });
    this.root.addEventListener('click', this.onClickAfterSwipe, true);
    document.addEventListener('keydown', this.onTrailerHotkey, true);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.show(0, false);
    this.updateAutoplayButton();
    this.restartTimer();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pauseTimer();
    window.removeEventListener('resize', this.scheduleHeroClearance);
    this.root.removeEventListener('load', this.scheduleHeroClearance, true);
    this.heroContentObserver?.disconnect();
    this.heroParentObserver?.disconnect();
    if (this.heroLayoutFrame !== null) cancelAnimationFrame(this.heroLayoutFrame);
    document.removeEventListener('keydown', this.onTrailerHotkey, true);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopTrailer(this.slides[this.index - this.windowStart]);
    this.root.remove();
  }

  /** Start after insertion so the following Jellyfin section can be measured. */
  startHeroLayoutGuard(): void {
    if (!this.response.useHeroLayout || this.heroLayoutGuardStarted) return;
    this.heroLayoutGuardStarted = true;
    window.addEventListener('resize', this.scheduleHeroClearance);
    this.root.addEventListener('load', this.scheduleHeroClearance, true);
    if (typeof ResizeObserver !== 'undefined') {
      this.heroContentObserver = new ResizeObserver(this.scheduleHeroClearance);
      this.observeActiveHeroContent();
    }
    if (this.root.parentElement) {
      this.heroParentObserver = new MutationObserver(this.scheduleHeroClearance);
      this.heroParentObserver.observe(this.root.parentElement, { childList: true });
    }
    this.scheduleHeroClearance();
  }

  private scheduleHeroClearance = (): void => {
    this.heroLayoutVerificationPasses = 0;
    this.queueHeroClearance();
  };

  private queueHeroClearance(): void {
    if (!this.heroLayoutGuardStarted || this.destroyed || this.heroLayoutFrame !== null) return;
    this.heroLayoutFrame = requestAnimationFrame(() => {
      this.heroLayoutFrame = null;
      this.updateHeroClearance();
    });
  }

  private observeActiveHeroContent(): void {
    this.heroContentObserver?.disconnect();
    const content = this.slides[this.index - this.windowStart]?.querySelector('.ec-content');
    if (!content) return;
    this.heroContentObserver?.observe(content);
    Array.from(content.children).forEach((child) => this.heroContentObserver?.observe(child));
  }

  private updateHeroClearance(): void {
    if (!this.root.isConnected) return;
    const section = this.root.nextElementSibling;
    const content = this.slides[this.index - this.windowStart]?.querySelector('.ec-content');
    if (!section || !content) return;
    const visibleChildren = Array.from(content.children).filter((child) => child.getClientRects().length);
    if (!visibleChildren.length) return;

    const contentBottom = Math.max(...visibleChildren.map((child) => child.getBoundingClientRect().bottom));
    const sectionTop = section.getBoundingClientRect().top;
    const current = Number.parseFloat(this.root.style.getPropertyValue('--ec-content-clearance')) || 0;
    const clearance = calculateHeroClearance(current, contentBottom, sectionTop);
    if (Math.abs(clearance - current) < 1) return;
    if (clearance) this.root.style.setProperty('--ec-content-clearance', `${clearance}px`);
    else this.root.style.removeProperty('--ec-content-clearance');
    if (this.heroLayoutVerificationPasses < 2) {
      this.heroLayoutVerificationPasses += 1;
      this.queueHeroClearance();
    }
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
    const activeSlide = this.slides[previous - this.windowStart];
    const focusedElement = document.activeElement;
    const focusedActionIndex = activeSlide && focusedElement instanceof HTMLButtonElement
      ? Array.from(activeSlide.querySelectorAll<HTMLButtonElement>('.ec-actions button')).indexOf(focusedElement)
      : -1;
    const focusedBanner = focusedElement === activeSlide;

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
      this.hasLeftInitialSlide ||= this.index > 0 || this.discardedItemCount > 0;
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
      const tabIndex = isActive && this.response.interactOnWholeBanner ? 0 : -1;
      if (slide.tabIndex !== tabIndex) slide.tabIndex = tabIndex;
      slide.querySelectorAll<HTMLButtonElement>('.ec-actions button').forEach((button) => {
        const actionTabIndex = isActive ? 0 : -1;
        if (button.tabIndex !== actionTabIndex) button.tabIndex = actionTabIndex;
      });
    });
    if (previous !== this.index && (focusedBanner || focusedActionIndex >= 0)) {
      const nextSlide = this.slides[localIndex];
      const nextAction = focusedActionIndex >= 0
        ? nextSlide?.querySelectorAll<HTMLButtonElement>('.ec-actions button')[focusedActionIndex]
        : null;
      if (nextAction) nextAction.focus();
      else if (this.response.interactOnWholeBanner) nextSlide?.focus();
      else nextSlide?.querySelector<HTMLButtonElement>('.ec-actions button')?.focus();
    }
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
    if (this.heroLayoutGuardStarted) {
      this.observeActiveHeroContent();
      this.scheduleHeroClearance();
    }
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
    // The initial batch is already enough to paint the carousel. Wait until the
    // viewer advances before using bandwidth and server time on another batch.
    if (!this.hasLeftInitialSlide) return false;
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
    replaceElementChildren(this.track);
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
        const newItems = (response.items ?? []).filter((item) => {
          if (this.seenItemIds.has(item.id)) return false;
          this.seenItemIds.add(item.id);
          return true;
        });
        newItems.forEach((item) => {
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

  private startTrailer(slide: HTMLElement, item: FeaturedItem, candidateIndex = 0): void {
    const candidates = item.trailers?.length ? item.trailers : item.trailer ? [item.trailer] : [];
    const trailer = candidates[candidateIndex];
    if (!this.response.enableBackgroundTrailers || !trailer || document.hidden) return;
    if (!this.response.allowTrailersOnMobile && isMobileTrailerClient()) return;
    if (this.trailerItemId === item.id
      && this.trailerCandidateIndex === candidateIndex
      && (this.trailerPlayer || this.trailerDelayTimer !== null)) return;
    this.stopTrailer();
    this.trailerItemId = item.id;
    this.trailerCandidateIndex = candidateIndex;
    const expectedIndex = this.index;
    const concealYouTube = trailer.provider === 'youtube'
      && this.response.hideYouTubeTrailerUntilControlsFade;
    const launchDelayMilliseconds = concealYouTube || candidateIndex > 0 ? 0 : this.response.trailerDelayMilliseconds;
    const concealDurationMilliseconds = concealYouTube
      ? Math.max(YOUTUBE_CONTROL_CONCEALMENT_MS, this.response.trailerDelayMilliseconds)
      : 0;
    if (concealYouTube) this.startTrailerCountdown();
    else if (launchDelayMilliseconds > 0) this.startTrailerCountdown(launchDelayMilliseconds);
    this.trailerDelayTimer = window.setTimeout(() => {
      this.trailerDelayTimer = null;
      if (this.destroyed || document.hidden || this.index !== expectedIndex) return;
      if (!concealYouTube) this.stopTrailerCountdown();
      let player: TrailerPlayer | null = null;
      const recover = (): void => {
        if (this.destroyed || this.index !== expectedIndex) return;
        if (player && this.trailerPlayer !== player) return;
        this.stopTrailer();
        if (candidateIndex + 1 < candidates.length) this.startTrailer(slide, item, candidateIndex + 1);
        else this.restartTimer();
      };
      player = createTrailerPlayer(trailer, {
        muted: concealYouTube ? true : this.trailerMuted,
        volume: this.trailerVolume,
        startOffsetSeconds: this.response.trailerStartOffsetSeconds,
        endOffsetSeconds: this.response.trailerEndOffsetSeconds,
        loop: !this.response.waitForTrailerToFinish,
        concealDurationMilliseconds,
        onConcealStart: (durationMilliseconds) => this.startTrailerCountdown(durationMilliseconds),
        onReveal: () => {
          if (!player || this.trailerPlayer !== player) return;
          this.stopTrailerCountdown();
          this.trailerConcealed = false;
          slide.classList.remove('ec-youtube-trailer-concealed');
          slide.classList.add('ec-trailer-active');
          void player.setMuted(this.trailerMuted);
        },
        onEnded: () => {
          if (this.response.waitForTrailerToFinish && this.autoplayEnabled && this.index === expectedIndex) {
            this.show(this.index + 1, false);
          }
        },
        onError: recover
      });
      if (!player) {
        recover();
        return;
      }
      this.trailerPlayer = player;
      this.trailerPaused = false;
      this.trailerConcealed = concealYouTube;
      this.trailerSlide = slide;
      slide.classList.toggle('ec-trailer-active', !concealYouTube);
      slide.classList.toggle('ec-youtube-trailer-concealed', concealYouTube);
      slide.querySelectorAll('.ec-media > .ec-trailer').forEach((element) => element.remove());
      slide.querySelector('.ec-backdrop')?.after(player.element);
      if (this.response.waitForTrailerToFinish) this.pauseTimer();
      void player.play().catch(recover);
    }, launchDelayMilliseconds);
  }

  private stopTrailer(_slide?: HTMLElement): void {
    if (this.trailerDelayTimer !== null) window.clearTimeout(this.trailerDelayTimer);
    this.trailerDelayTimer = null;
    this.stopTrailerCountdown();
    this.trailerPlayer?.destroy();
    this.trailerPlayer = null;
    this.trailerSlide?.classList.remove('ec-trailer-active');
    this.trailerSlide?.classList.remove('ec-youtube-trailer-concealed');
    this.trailerSlide = null;
    this.trailerItemId = null;
    this.trailerCandidateIndex = -1;
    this.trailerPaused = false;
    this.trailerConcealed = false;
  }

  private startTrailerCountdown(durationMilliseconds?: number): void {
    this.clearTrailerCountdownTimer();
    if (!this.autoplayButton || !this.trailerCountdownProgress) return;
    this.autoplayButton.classList.add('ec-countdown-active');
    this.autoplayButton.classList.toggle('ec-countdown-loading', durationMilliseconds === undefined);
    if (durationMilliseconds === undefined) {
      this.trailerCountdownProgress.style.removeProperty('stroke-dashoffset');
      return;
    }
    const duration = Math.max(1, durationMilliseconds);
    const endsAt = performance.now() + duration;
    const update = (): void => {
      const remaining = Math.max(0, endsAt - performance.now());
      this.trailerCountdownProgress!.style.strokeDashoffset = String(100 - ((remaining / duration) * 100));
    };
    update();
    this.trailerCountdownTimer = window.setInterval(update, 100);
  }

  private clearTrailerCountdownTimer(): void {
    if (this.trailerCountdownTimer !== null) window.clearInterval(this.trailerCountdownTimer);
    this.trailerCountdownTimer = null;
  }

  private stopTrailerCountdown(): void {
    this.clearTrailerCountdownTimer();
    this.autoplayButton?.classList.remove('ec-countdown-active', 'ec-countdown-loading');
    this.trailerCountdownProgress?.style.removeProperty('stroke-dashoffset');
  }

  private pauseTimer = (): void => {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  };

  private restartTimer = (): void => {
    this.pauseTimer();
    if (!this.autoplayEnabled || this.slides.length < 2 || document.hidden || this.destroyed || this.trailerPaused
      || this.root.contains(document.activeElement)) return;
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
    if (event.target !== this.slides[this.index - this.windowStart] || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    this.show(this.index + (event.key === 'ArrowLeft' ? -1 : 1));
  };

  private onTrailerHotkey = (event: KeyboardEvent): void => {
    if (!this.trailerPlayer || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"]')) return;
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      event.stopPropagation();
      this.trailerMuted = !this.trailerMuted;
      if (!this.trailerMuted && this.trailerVolume === 0) {
        this.trailerVolume = 10;
        saveTrailerVolume(this.trailerVolume);
        void this.trailerPlayer.setVolume(this.trailerVolume);
      }
      if (!this.trailerConcealed) void this.trailerPlayer.setMuted(this.trailerMuted);
      return;
    }
    const volumeUp = event.key === '+' || event.code === 'NumpadAdd';
    const volumeDown = event.key === '-' || event.code === 'NumpadSubtract';
    if (volumeUp || volumeDown) {
      event.preventDefault();
      event.stopPropagation();
      const direction = volumeUp ? 1 : -1;
      this.trailerVolume = Math.max(0, Math.min(100, this.trailerVolume + (direction * 10)));
      saveTrailerVolume(this.trailerVolume);
      this.trailerMuted = this.trailerVolume === 0;
      void this.trailerPlayer.setVolume(this.trailerVolume);
      if (!this.trailerConcealed) void this.trailerPlayer.setMuted(this.trailerMuted);
      return;
    }
    if (event.code !== 'Space' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    this.trailerPaused = !this.trailerPaused;
    if (this.trailerPaused) {
      void this.trailerPlayer.pause();
      this.pauseTimer();
    } else {
      void this.trailerPlayer.play();
      if (!this.response.waitForTrailerToFinish) this.restartTimer();
    }
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
      this.show(this.index + (deltaX < 0 ? 1 : -1));
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
      this.stopTrailer(this.slides[this.index - this.windowStart]);
    } else {
      this.startTrailer(this.slides[this.index - this.windowStart], this.items[this.index]);
      this.restartTimer();
    }
  };
}
