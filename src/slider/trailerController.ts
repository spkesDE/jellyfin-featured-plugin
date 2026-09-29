import { CONSOLE_PREFIX } from '../constants';
import { t } from '../i18n';
import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { createTrailerPlayer, isMobileTrailerClient, type TrailerPlayer } from './trailer';
import { readTrailerVolume, requiresLegacyVerticalRangeAppearance, saveTrailerVolume } from './trailerVolume';

const YOUTUBE_CONTROL_CONCEALMENT_MS = 5000;
const TRAILER_VOLUME_PLACEMENTS = ['right', 'left', 'up', 'down'] as const;

type TrailerVolumePlacement = (typeof TRAILER_VOLUME_PLACEMENTS)[number];

interface TrailerControllerCallbacks {
  getActiveIndex(): number;
  isDestroyed(): boolean;
  isAutoplayEnabled(): boolean;
  advance(): void;
  pauseAutoplay(): void;
  restartAutoplay(): void;
}

/**
 * Owns one carousel's background-media lifecycle and every listener used by its controls.
 * Carousel navigation stays behind callbacks so provider failures cannot mutate window state directly.
 */
export class TrailerController {
  readonly controls: HTMLDivElement | null;
  private readonly response: FeaturedResponse;
  private readonly autoplayButton: HTMLButtonElement | null;
  private readonly countdownProgress: SVGCircleElement | null;
  private readonly callbacks: TrailerControllerCallbacks;
  private pauseButton: HTMLButtonElement | null = null;
  private muteButton: HTMLButtonElement | null = null;
  private volumeControl: HTMLDivElement | null = null;
  private volumePopover: HTMLDivElement | null = null;
  private volumeInput: HTMLInputElement | null = null;
  private countdownTimer: number | null = null;
  private player: TrailerPlayer | null = null;
  private slide: HTMLElement | null = null;
  private delayTimer: number | null = null;
  private itemId: string | null = null;
  private candidateIndex = -1;
  private muted: boolean;
  private volume: number;
  private paused = false;
  private concealed = false;
  private isTrickplay = false;

  constructor(
    response: FeaturedResponse,
    hasTrailers: boolean,
    autoplayButton: HTMLButtonElement | null,
    countdownProgress: SVGCircleElement | null,
    callbacks: TrailerControllerCallbacks
  ) {
    this.response = response;
    this.autoplayButton = autoplayButton;
    this.countdownProgress = countdownProgress;
    this.callbacks = callbacks;
    this.volume = readTrailerVolume();
    // Browser autoplay rules can still require interaction before audible playback.
    this.muted = response.startTrailersMuted || this.volume === 0;
    this.controls = response.showTrailerControls && hasTrailers ? this.createControls() : null;

    document.addEventListener('keydown', this.onHotkey, true);
    window.addEventListener('resize', this.placeVolumePopover);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  start(slide: HTMLElement, item: FeaturedItem, candidateIndex = 0): void {
    const candidates = item.trailers?.length ? item.trailers : item.trailer ? [item.trailer] : [];
    const trailer = candidates[candidateIndex];
    const isTrickplay = trailer?.provider === 'trickplay';
    const isMediaPreview = trailer?.provider === 'media-preview';
    const isFallbackMedia = isTrickplay || isMediaPreview;
    if ((!this.response.enableBackgroundTrailers && !isFallbackMedia) || !trailer || document.hidden) return;
    if (!isTrickplay && !this.response.allowTrailersOnMobile && isMobileTrailerClient()) return;
    if (this.itemId === item.id && this.candidateIndex === candidateIndex && (this.player || this.delayTimer !== null))
      return;

    this.stop();
    this.itemId = item.id;
    this.candidateIndex = candidateIndex;
    const expectedIndex = this.callbacks.getActiveIndex();
    const concealYouTube = trailer.provider === 'youtube' && this.response.hideYouTubeTrailerUntilControlsFade;
    let launchDelayMilliseconds = concealYouTube || candidateIndex > 0 ? 0 : this.response.trailerDelayMilliseconds;
    if (isFallbackMedia && item.hasImage === false) launchDelayMilliseconds = 0;
    const concealDurationMilliseconds = concealYouTube
      ? Math.max(YOUTUBE_CONTROL_CONCEALMENT_MS, this.response.trailerDelayMilliseconds)
      : 0;
    if (concealYouTube) this.startCountdown();
    else if (launchDelayMilliseconds > 0) this.startCountdown(launchDelayMilliseconds);

    this.delayTimer = window.setTimeout(() => {
      this.delayTimer = null;
      if (this.callbacks.isDestroyed() || document.hidden || this.callbacks.getActiveIndex() !== expectedIndex) return;
      if (!concealYouTube) this.stopCountdown();
      let player: TrailerPlayer | null = null;
      const recover = (error?: Error): void => {
        if (this.callbacks.isDestroyed() || this.callbacks.getActiveIndex() !== expectedIndex) return;
        if (player && this.player !== player) return;
        if (error) console.warn(`${CONSOLE_PREFIX} Background media fallback failed.`, error);
        this.stop();
        if (candidateIndex + 1 < candidates.length) this.start(slide, item, candidateIndex + 1);
        else this.callbacks.restartAutoplay();
      };
      player = createTrailerPlayer(trailer, {
        muted: concealYouTube ? true : this.muted,
        volume: this.volume,
        startOffsetSeconds: this.response.trailerStartOffsetSeconds,
        endOffsetSeconds: this.response.trailerEndOffsetSeconds,
        loop: !this.response.waitForTrailerToFinish,
        concealDurationMilliseconds,
        onConcealStart: (durationMilliseconds) => this.startCountdown(durationMilliseconds),
        onReveal: () => {
          if (!player || this.player !== player) return;
          this.stopCountdown();
          this.concealed = false;
          slide.classList.remove('featured-youtube-trailer-concealed');
          slide.classList.add('featured-trailer-active');
          void player.setMuted(this.muted);
          this.updateControls();
        },
        onEnded: () => {
          if (
            this.response.waitForTrailerToFinish &&
            this.callbacks.isAutoplayEnabled() &&
            this.callbacks.getActiveIndex() === expectedIndex
          ) {
            this.callbacks.advance();
          } else if (isMediaPreview && this.callbacks.getActiveIndex() === expectedIndex) {
            this.stop();
            this.callbacks.restartAutoplay();
          }
        },
        onError: recover
      });
      if (!player) {
        recover();
        return;
      }
      this.player = player;
      this.isTrickplay = isTrickplay;
      this.paused = false;
      this.concealed = concealYouTube;
      this.slide = slide;
      slide.classList.toggle('featured-trailer-active', !concealYouTube);
      slide.classList.toggle('featured-youtube-trailer-concealed', concealYouTube);
      slide.querySelectorAll('.featured-media > .featured-trailer').forEach((element) => element.remove());
      slide.querySelector('.featured-backdrop')?.after(player.element);
      this.updateControls();
      if (this.response.waitForTrailerToFinish) this.callbacks.pauseAutoplay();
      void player.play().catch(recover);
    }, launchDelayMilliseconds);
  }

  stop(): void {
    if (this.delayTimer !== null) window.clearTimeout(this.delayTimer);
    this.delayTimer = null;
    this.stopCountdown();
    this.player?.destroy();
    this.player = null;
    this.slide?.classList.remove('featured-trailer-active', 'featured-youtube-trailer-concealed');
    this.slide = null;
    this.itemId = null;
    this.candidateIndex = -1;
    this.paused = false;
    this.concealed = false;
    this.isTrickplay = false;
    this.updateControls();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onHotkey, true);
    window.removeEventListener('resize', this.placeVolumePopover);
    this.stop();
  }

  private createControls(): HTMLDivElement {
    const controls = document.createElement('div');
    controls.className = 'featured-trailer-controls';
    controls.hidden = true;

    this.pauseButton = document.createElement('button');
    this.pauseButton.type = 'button';
    this.pauseButton.className =
      'featured-control featured-trailer-pause emby-scrollbuttons-button paper-icon-button-light';
    this.pauseButton.addEventListener('click', () => this.togglePaused());
    controls.appendChild(this.pauseButton);

    this.volumeControl = document.createElement('div');
    this.volumeControl.className =
      'featured-trailer-volume-control featured-volume-' + this.response.trailerVolumeSliderDirection;
    this.volumeControl.addEventListener('pointerenter', this.placeVolumePopover);
    this.volumeControl.addEventListener('focusin', this.placeVolumePopover);

    this.muteButton = document.createElement('button');
    this.muteButton.type = 'button';
    this.muteButton.className =
      'featured-control featured-trailer-mute emby-scrollbuttons-button paper-icon-button-light';
    this.muteButton.addEventListener('click', () => this.toggleMuted());
    this.volumeControl.appendChild(this.muteButton);

    this.volumeInput = document.createElement('input');
    this.volumeInput.type = 'range';
    this.volumeInput.className = 'featured-trailer-volume';
    this.volumeInput.min = '0';
    this.volumeInput.max = '100';
    this.volumeInput.step = '1';
    if (
      (this.response.trailerVolumeSliderDirection === 'up' || this.response.trailerVolumeSliderDirection === 'down') &&
      requiresLegacyVerticalRangeAppearance()
    ) {
      this.volumeInput.style.setProperty('-webkit-appearance', 'slider-vertical');
    }
    this.volumeInput.addEventListener('input', () => this.setVolume(Number(this.volumeInput?.value ?? this.volume)));
    this.volumeInput.addEventListener('pointerup', this.releaseVolumeInput);
    this.volumeInput.addEventListener('pointercancel', this.releaseVolumeInput);

    this.volumePopover = document.createElement('div');
    this.volumePopover.className = 'featured-trailer-volume-popover';
    this.volumePopover.appendChild(this.volumeInput);
    this.volumeControl.appendChild(this.volumePopover);
    controls.appendChild(this.volumeControl);
    this.updateControls();
    return controls;
  }

  private startCountdown(durationMilliseconds?: number): void {
    this.clearCountdownTimer();
    if (!this.autoplayButton || !this.countdownProgress) return;
    this.autoplayButton.classList.add('featured-countdown-active');
    this.autoplayButton.classList.toggle('featured-countdown-loading', durationMilliseconds === undefined);
    if (durationMilliseconds === undefined) {
      this.countdownProgress.style.removeProperty('stroke-dashoffset');
      return;
    }
    const duration = Math.max(1, durationMilliseconds);
    const endsAt = performance.now() + duration;
    const update = (): void => {
      const remaining = Math.max(0, endsAt - performance.now());
      this.countdownProgress!.style.strokeDashoffset = String(100 - (remaining / duration) * 100);
    };
    update();
    this.countdownTimer = window.setInterval(update, 100);
  }

  private clearCountdownTimer(): void {
    if (this.countdownTimer !== null) window.clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  private stopCountdown(): void {
    this.clearCountdownTimer();
    this.autoplayButton?.classList.remove('featured-countdown-active', 'featured-countdown-loading');
    this.countdownProgress?.style.removeProperty('stroke-dashoffset');
  }

  private updateControls(): void {
    if (this.controls) {
      this.controls.hidden = !this.player || this.concealed;
      if (!this.controls.hidden) window.requestAnimationFrame(this.placeVolumePopover);
    }
    if (this.volumeControl) this.volumeControl.hidden = this.isTrickplay;
    if (this.pauseButton) {
      const icon = this.getOrCreateIcon(this.pauseButton);
      icon.className = `material-icons ${this.paused ? 'play_arrow' : 'pause'}`;
      const label = this.paused ? t('carousel.resumeTrailer') : t('carousel.pauseTrailer');
      this.pauseButton.setAttribute('aria-label', label);
      this.pauseButton.setAttribute('aria-pressed', String(this.paused));
      this.pauseButton.title = label;
    }
    if (!this.muteButton) return;
    const icon = this.getOrCreateIcon(this.muteButton);
    icon.className = `material-icons ${this.muted ? 'volume_off' : 'volume_up'}`;
    const label = this.muted ? t('carousel.unmuteTrailer') : t('carousel.muteTrailer');
    this.muteButton.setAttribute('aria-label', label);
    this.muteButton.setAttribute('aria-pressed', String(this.muted));
    this.muteButton.title = label;
    if (this.volumeInput) {
      this.volumeInput.value = String(this.volume);
      this.volumeInput.setAttribute('aria-label', t('carousel.trailerVolume'));
      this.volumeInput.setAttribute('aria-valuetext', `${this.volume}%`);
      this.volumeInput.title = `${t('carousel.trailerVolume')}: ${this.volume}%`;
    }
  }

  private getOrCreateIcon(button: HTMLButtonElement): HTMLElement {
    const existing = button.querySelector<HTMLElement>('.material-icons');
    if (existing) return existing;
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    return icon;
  }

  private placeVolumePopover = (): void => {
    const control = this.volumeControl;
    const popover = this.volumePopover;
    if (!control || !popover || !control.offsetParent) return;

    const preferred = this.response.trailerVolumeSliderDirection;
    const candidates: TrailerVolumePlacement[] =
      preferred === 'side'
        ? ['right', 'left', 'down', 'up']
        : preferred === 'down'
          ? ['down', 'up', 'left', 'right']
          : ['up', 'down', 'left', 'right'];
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const edgeMargin = 8;
    let bestPlacement = candidates[0];
    let lowestOverflow = Number.POSITIVE_INFINITY;

    const applyPlacement = (placement: TrailerVolumePlacement): void => {
      control.classList.remove(...TRAILER_VOLUME_PLACEMENTS.map((item) => `featured-volume-${item}`));
      control.classList.add(`featured-volume-${placement}`);
      this.volumeInput?.setAttribute(
        'aria-orientation',
        placement === 'up' || placement === 'down' ? 'vertical' : 'horizontal'
      );
    };

    for (const placement of candidates) {
      applyPlacement(placement);
      const rect = popover.getBoundingClientRect();
      const overflow =
        Math.max(0, edgeMargin - rect.left) +
        Math.max(0, rect.right + edgeMargin - viewportWidth) +
        Math.max(0, edgeMargin - rect.top) +
        Math.max(0, rect.bottom + edgeMargin - viewportHeight);
      if (overflow < lowestOverflow) {
        bestPlacement = placement;
        lowestOverflow = overflow;
      }
      if (overflow === 0) break;
    }
    applyPlacement(bestPlacement);
  };

  private toggleMuted(): void {
    if (!this.player) return;
    this.muted = !this.muted;
    if (!this.muted && this.volume === 0) {
      this.volume = 10;
      saveTrailerVolume(this.volume);
      void this.player.setVolume(this.volume);
    }
    if (!this.concealed) void this.player.setMuted(this.muted);
    this.updateControls();
  }

  private setVolume(volume: number): void {
    if (!this.player || !Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(100, volume));
    saveTrailerVolume(this.volume);
    this.muted = this.volume === 0;
    void this.player.setVolume(this.volume);
    if (!this.concealed) void this.player.setMuted(this.muted);
    this.updateControls();
  }

  private releaseVolumeInput = (): void => {
    this.volumeInput?.blur();
  };

  private togglePaused(): void {
    if (!this.player) return;
    this.paused = !this.paused;
    if (this.paused) {
      void this.player.pause();
      this.callbacks.pauseAutoplay();
    } else {
      void this.player.play();
      if (!this.response.waitForTrailerToFinish) this.callbacks.restartAutoplay();
    }
    this.updateControls();
  }

  private onHotkey = (event: KeyboardEvent): void => {
    if (!this.player || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"]')) return;
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      event.stopPropagation();
      this.toggleMuted();
      return;
    }
    const volumeUp = event.key === '+' || event.code === 'NumpadAdd';
    const volumeDown = event.key === '-' || event.code === 'NumpadSubtract';
    if (volumeUp || volumeDown) {
      event.preventDefault();
      event.stopPropagation();
      this.setVolume(this.volume + (volumeUp ? 10 : -10));
      return;
    }
    if (event.code !== 'Space' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    this.togglePaused();
  };
}
