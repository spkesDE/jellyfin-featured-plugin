import { getAccessToken, getApiClient } from '../core/apiClient';
import type { FeaturedTrailer } from '../types/featured';

export interface TrailerPlaybackOptions {
  muted: boolean;
  volume: number;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  loop: boolean;
  onEnded: () => void;
  onError: (error: Error) => void;
  concealDurationMilliseconds?: number;
  onConcealStart?: (durationMilliseconds: number) => void;
  onReveal?: () => void;
}

export interface TrailerPlayer {
  readonly element: HTMLElement;
  play(): Promise<void>;
  pause(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setVolume(volume: number): Promise<void>;
  destroy(): void;
}

function localTrailerUrl(trailerId: string): string {
  const api = getApiClient();
  const token = getAccessToken();
  return api?.getUrl?.(`Videos/${encodeURIComponent(trailerId)}/stream`, {
    Static: true,
    MediaSourceId: trailerId,
    DeviceId: api.deviceId?.(),
    api_key: token
  }) ?? '';
}

abstract class HtmlVideoPlayer implements TrailerPlayer {
  readonly element: HTMLVideoElement;

  private readonly startOffsetSeconds: number;
  private readonly endOffsetSeconds: number;
  private readonly loop: boolean;
  private readonly onEnded: () => void;
  private readonly onError: (error: Error) => void;
  private playbackWatchdog: number | null = null;
  private destroyed = false;
  private ended = false;
  private failed = false;

  protected constructor(url: string, options: TrailerPlaybackOptions) {
    this.startOffsetSeconds = options.startOffsetSeconds;
    this.endOffsetSeconds = options.endOffsetSeconds;
    this.loop = options.loop;
    this.onEnded = options.onEnded;
    this.onError = options.onError;

    this.element = document.createElement('video');
    this.element.className = 'ec-trailer';
    this.element.src = url;
    this.element.muted = options.muted;
    this.element.defaultMuted = options.muted;
    this.element.volume = clamp(options.volume, 0, 100) / 100;
    this.element.loop = options.loop && options.endOffsetSeconds === 0;
    this.element.autoplay = true;
    this.element.playsInline = true;
    this.element.preload = 'auto';
    this.element.controls = false;
    this.element.disablePictureInPicture = true;
    this.element.tabIndex = -1;
    this.element.setAttribute('playsinline', '');
    this.element.setAttribute('webkit-playsinline', '');
    this.element.setAttribute('aria-hidden', 'true');
    if (options.muted) this.element.setAttribute('muted', '');

    this.element.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.element.addEventListener('timeupdate', this.handleTimeUpdate);
    this.element.addEventListener('ended', this.handleEnded);
    this.element.addEventListener('playing', this.clearPlaybackWatchdog);
    this.element.addEventListener('canplay', this.clearPlaybackWatchdog);
    this.element.addEventListener('waiting', this.armPlaybackWatchdog);
    this.element.addEventListener('stalled', this.armPlaybackWatchdog);
    this.element.addEventListener('error', this.handleMediaError);
    this.element.addEventListener('abort', this.handleMediaError);
    this.armPlaybackWatchdog();
  }

  async play(): Promise<void> {
    await this.element.play();
  }

  async pause(): Promise<void> {
    this.element.pause();
  }

  async setMuted(muted: boolean): Promise<void> {
    this.element.muted = muted;
  }

  async setVolume(volume: number): Promise<void> {
    this.element.volume = clamp(volume, 0, 100) / 100;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearPlaybackWatchdog();

    this.element.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.element.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.element.removeEventListener('ended', this.handleEnded);
    this.element.removeEventListener('playing', this.clearPlaybackWatchdog);
    this.element.removeEventListener('canplay', this.clearPlaybackWatchdog);
    this.element.removeEventListener('waiting', this.armPlaybackWatchdog);
    this.element.removeEventListener('stalled', this.armPlaybackWatchdog);
    this.element.removeEventListener('error', this.handleMediaError);
    this.element.removeEventListener('abort', this.handleMediaError);

    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
  }

  private handleLoadedMetadata = (): void => {
    if (
      this.startOffsetSeconds > 0
      && this.startOffsetSeconds < this.element.duration
    ) {
      this.element.currentTime = this.startOffsetSeconds;
    }
  };

  private handleTimeUpdate = (): void => {
    this.clearPlaybackWatchdog();
    if (this.endOffsetSeconds <= 0 || !Number.isFinite(this.element.duration)) return;
    if (this.element.currentTime < this.element.duration - this.endOffsetSeconds) return;

    if (this.loop) {
      this.element.currentTime = this.startOffsetSeconds;
      void this.element.play().catch(() => undefined);
      return;
    }

    this.element.pause();
    this.handleEnded();
  };

  private handleEnded = (): void => {
    if (this.ended) return;
    this.ended = true;
    this.clearPlaybackWatchdog();
    this.onEnded();
  };

  private handleMediaError = (): void => {
    this.fail(new Error('Trailer media could not be played.'));
  };

  private armPlaybackWatchdog = (): void => {
    this.clearPlaybackWatchdog();
    this.playbackWatchdog = window.setTimeout(
      () => this.fail(new Error('Trailer playback stalled.')),
      8000
    );
  };

  private clearPlaybackWatchdog = (): void => {
    if (this.playbackWatchdog !== null) window.clearTimeout(this.playbackWatchdog);
    this.playbackWatchdog = null;
  };

  private fail(error: Error): void {
    if (this.destroyed || this.failed) return;
    this.failed = true;
    this.clearPlaybackWatchdog();
    this.onError(error);
  }
}

export class JellyfinLocalPlayer extends HtmlVideoPlayer {
  constructor(itemId: string, options: TrailerPlaybackOptions) {
    super(localTrailerUrl(itemId), options);
  }
}

export class DirectVideoPlayer extends HtmlVideoPlayer {
  constructor(url: string, options: TrailerPlaybackOptions) {
    super(url, options);
  }
}

const YOUTUBE_HOSTS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com'
] as const;
const YOUTUBE_API_TIMEOUT_MS = 8_000;
// These codes describe the requested video, not the selected YouTube host.
// Let the carousel try the item's next trailer candidate without poisoning or
// retrying the privacy host for a video that cannot be embedded there either.
const YOUTUBE_ITEM_SPECIFIC_ERRORS = new Set([2, 100, 101, 150]);

let youtubePlayerSequence = 0;
let youtubeApiPromise: Promise<YouTubeApi> | null = null;

export class YouTubePlayer implements TrailerPlayer {
  readonly element: HTMLDivElement;

  private player: YouTubePlayerInstance | null = null;
  private attempt = 0;
  private endTimer: number | null = null;
  private revealTimer: number | null = null;
  private startupTimer: number | null = null;
  private destroyed = false;
  private failed = false;
  private readyResolved = false;
  private resolveReady: (() => void) | null = null;
  private readonly ready: Promise<void>;

  constructor(videoId: string, options: TrailerPlaybackOptions) {
    this.element = document.createElement('div');
    this.element.className = 'ec-trailer';
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-hidden', 'true');

    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });

    void this.initialize(videoId, options);
  }

  async play(): Promise<void> {
    await this.ready;
    if (!this.destroyed && !this.failed) this.player?.playVideo();
  }

  async pause(): Promise<void> {
    await this.ready;
    if (!this.destroyed && !this.failed) this.player?.pauseVideo();
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.ready;
    if (this.destroyed || this.failed) return;
    if (muted) this.player?.mute();
    else this.player?.unMute();
  }

  async setVolume(volume: number): Promise<void> {
    await this.ready;
    if (!this.destroyed && !this.failed) {
      this.player?.setVolume(clamp(volume, 0, 100));
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    ++this.attempt;
    this.clearTimers();

    try {
      this.player?.destroy();
    } catch {
      // Ignore teardown errors from the external player API.
    }

    this.player = null;
    this.element.replaceChildren();
    this.element.remove();
    this.resolveReadyOnce();
  }

  private async initialize(
    videoId: string,
    options: TrailerPlaybackOptions
  ): Promise<void> {
    try {
      const api = await loadYouTubeApi();
      if (!this.destroyed && !this.failed) {
        this.startPlayer(api, videoId, options, 0);
      }
    } catch (error) {
      this.fail(options, asError(error, 'YouTube player API could not be loaded.'));
    }
  }

  private startPlayer(
    api: YouTubeApi,
    videoId: string,
    options: TrailerPlaybackOptions,
    hostIndex: number
  ): void {
    if (this.destroyed || this.failed) return;

    const host = YOUTUBE_HOSTS[hostIndex];
    if (!host) {
      this.fail(options, new Error('No YouTube embed host is available.'));
      return;
    }

    const attempt = ++this.attempt;
    const startupTimeout = hostIndex === 0 ? 2500 : 8000;
    let recoveryStarted = false;
    let playbackConfirmed = false;

    this.clearTimers();
    try {
      this.player?.destroy();
    } catch {
      // Ignore stale-player teardown errors.
    }
    this.player = null;
    this.element.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.id = `ec-youtube-player-${++youtubePlayerSequence}`;
    iframe.className = 'ec-youtube-frame';
    iframe.tabIndex = -1;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'YouTube trailer');
    iframe.src = createYouTubeEmbedUrl(host, videoId, options);

    const isCurrent = (): boolean => (
      !this.destroyed
      && !this.failed
      && attempt === this.attempt
    );

    const recover = (error: Error): void => {
      if (!isCurrent() || recoveryStarted) return;
      recoveryStarted = true;
      this.clearStartupTimer();

      window.setTimeout(() => {
        if (!isCurrent()) return;
        if (hostIndex + 1 < YOUTUBE_HOSTS.length) {
          this.startPlayer(api, videoId, options, hostIndex + 1);
        } else {
          this.fail(options, error);
        }
      }, 0);
    };

    const confirmPlayback = (): void => {
      if (!isCurrent() || playbackConfirmed) return;
      playbackConfirmed = true;
      this.clearStartupTimer();
      this.reveal(options, attempt);
    };

    iframe.addEventListener('load', () => {
      if (!isCurrent() || !iframe.isConnected) return;

      // Important: attach YT.Player only after the iframe has loaded.
      // Doing this immediately after insertion can cause Chromium to abort
      // the first iframe navigation with ERR_ABORTED.
      window.setTimeout(() => {
        if (!isCurrent() || !iframe.isConnected) return;

        try {
          this.player = new api.Player(iframe, {
            events: {
              onReady: ({ target }) => {
                if (!isCurrent()) return;
                this.resolveReadyOnce();

                const playerIframe = target.getIframe();
                playerIframe.classList.add('ec-youtube-frame');
                playerIframe.tabIndex = -1;
                playerIframe.referrerPolicy = 'strict-origin-when-cross-origin';
                playerIframe.setAttribute(
                  'allow',
                  'autoplay; encrypted-media; picture-in-picture'
                );
                playerIframe.setAttribute('aria-hidden', 'true');

                if (options.muted) target.mute();
                else target.unMute();
                target.setVolume(clamp(options.volume, 0, 100));
                if (options.startOffsetSeconds > 0) {
                  target.seekTo(options.startOffsetSeconds, true);
                }
                target.playVideo();

                if (options.endOffsetSeconds > 0) {
                  this.startEndTimer(target, options, isCurrent);
                }
              },
              onStateChange: ({ data }) => {
                if (!isCurrent()) return;
                if (data === 1 || data === 3) confirmPlayback();
                if (data === 0 && !options.loop) options.onEnded();
              },
              onError: ({ data }) => {
                if (!isCurrent()) return;

                const error = new Error(
                  `YouTube trailer failed with player error ${data}.`
                );

                console.warn('[Featured][YouTube]', error.message, {
                  videoId,
                  host,
                  code: data
                });

                if (YOUTUBE_ITEM_SPECIFIC_ERRORS.has(data)) {
                  this.fail(options, error);
                } else {
                  recover(error);
                }
              }
            }
          });
        } catch (error) {
          recover(asError(error, 'YouTube player could not be created.'));
        }
      }, 0);
    }, { once: true });

    iframe.addEventListener('error', () => {
      recover(new Error(`YouTube iframe failed to load from ${host}.`));
    }, { once: true });

    this.startupTimer = window.setTimeout(() => {
      recover(new Error(`YouTube trailer did not start within ${startupTimeout} ms.`));
    }, startupTimeout);

    this.element.appendChild(iframe);
  }

  private startEndTimer(
    target: YouTubePlayerInstance,
    options: TrailerPlaybackOptions,
    isCurrent: () => boolean
  ): void {
    this.clearEndTimer();
    this.endTimer = window.setInterval(() => {
      if (!isCurrent()) {
        this.clearEndTimer();
        return;
      }

      const duration = target.getDuration();
      if (
        duration <= 0
        || target.getCurrentTime() < duration - options.endOffsetSeconds
      ) {
        return;
      }

      if (options.loop) {
        target.seekTo(options.startOffsetSeconds, true);
        target.playVideo();
      } else {
        this.clearEndTimer();
        target.pauseVideo();
        options.onEnded();
      }
    }, 250);
  }

  private reveal(options: TrailerPlaybackOptions, attempt: number): void {
    const duration = options.concealDurationMilliseconds ?? 0;
    if (duration <= 0) {
      options.onReveal?.();
      return;
    }

    options.onConcealStart?.(duration);
    this.clearRevealTimer();
    this.revealTimer = window.setTimeout(() => {
      this.revealTimer = null;
      if (!this.destroyed && !this.failed && attempt === this.attempt) {
        options.onReveal?.();
      }
    }, duration);
  }

  private resolveReadyOnce(): void {
    if (this.readyResolved) return;
    this.readyResolved = true;
    this.resolveReady?.();
    this.resolveReady = null;
  }

  private clearEndTimer(): void {
    if (this.endTimer !== null) window.clearInterval(this.endTimer);
    this.endTimer = null;
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) window.clearTimeout(this.revealTimer);
    this.revealTimer = null;
  }

  private clearStartupTimer(): void {
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.startupTimer = null;
  }

  private clearTimers(): void {
    this.clearEndTimer();
    this.clearRevealTimer();
    this.clearStartupTimer();
  }

  private fail(options: TrailerPlaybackOptions, error: Error): void {
    if (this.destroyed || this.failed) return;
    this.failed = true;
    this.clearTimers();
    this.resolveReadyOnce();
    console.warn('[Featured][YouTube]', error.message);
    options.onError(error);
  }
}

function createYouTubeEmbedUrl(
  host: string,
  videoId: string,
  options: TrailerPlaybackOptions
): string {
  const url = new URL(`/embed/${encodeURIComponent(videoId)}`, `${host}/`);
  const params: Record<string, string | number | undefined> = {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    enablejsapi: 1,
    fs: 0,
    loop: options.loop ? 1 : 0,
    modestbranding: 1,
    mute: options.muted ? 1 : 0,
    origin: window.location.origin,
    playsinline: 1,
    rel: 0,
    start: options.startOffsetSeconds,
    widget_referrer: window.location.origin,
    playlist: options.loop ? videoId : undefined
  };

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as Window & {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  };

  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  const pending = new Promise<YouTubeApi>((resolve, reject) => {
    let settled = false;

    const finish = (api?: YouTubeApi, error?: Error): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (api) resolve(api);
      else reject(error ?? new Error('YouTube player API did not initialize.'));
    };

    const timeout = window.setTimeout(
      () => finish(undefined, new Error('YouTube player API timed out.')),
      YOUTUBE_API_TIMEOUT_MS
    );

    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      finish(
        youtubeWindow.YT?.Player ? youtubeWindow.YT : undefined,
        new Error('YouTube player API did not initialize.')
      );
    };

    if (!document.querySelector('script[data-ec-youtube-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.ecYoutubeApi = 'true';
      script.async = true;
      script.onerror = () => finish(
        undefined,
        new Error('YouTube player API could not be loaded.')
      );
      document.head.appendChild(script);
    }
  });

  youtubeApiPromise = pending;
  void pending.catch(() => {
    if (youtubeApiPromise === pending) youtubeApiPromise = null;
  });

  return pending;
}

interface YouTubePlayerInstance {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  unMute(): void;
}

interface YouTubeApi {
  Player: new (
    element: string | HTMLElement,
    options: YouTubePlayerOptions
  ) => YouTubePlayerInstance;
}

interface YouTubePlayerOptions {
  events: {
    onReady: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange: (event: { data: number; target: YouTubePlayerInstance }) => void;
    onError: (event: { data: number }) => void;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export class ExternalPlayer {
  constructor(private readonly url: string) { }

  open(): void {
    window.open(this.url, '_blank', 'noopener,noreferrer');
  }
}

export function createTrailerPlayer(
  trailer: FeaturedTrailer,
  options: TrailerPlaybackOptions
): TrailerPlayer | null {
  if (trailer.type === 'local' && trailer.itemId) {
    const url = localTrailerUrl(trailer.itemId);
    return url ? new JellyfinLocalPlayer(trailer.itemId, options) : null;
  }
  if (trailer.provider === 'youtube' && trailer.videoId) {
    return new YouTubePlayer(trailer.videoId, options);
  }
  if (trailer.provider === 'direct' && trailer.url) {
    return new DirectVideoPlayer(trailer.url, options);
  }
  return null;
}

export function isMobileTrailerClient(): boolean {
  return window.matchMedia?.('(max-width: 767px)').matches
    || window.matchMedia?.('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIosTrailerClient(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
