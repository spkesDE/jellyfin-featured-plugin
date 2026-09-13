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
  private readonly endOffsetSeconds: number;
  private readonly startOffsetSeconds: number;
  private readonly loop: boolean;
  private readonly onEnded: () => void;
  private readonly onError: (error: Error) => void;
  private ended = false;
  private failed = false;
  private destroyed = false;
  private playbackWatchdog: number | null = null;

  protected constructor(url: string, options: TrailerPlaybackOptions) {
    this.endOffsetSeconds = options.endOffsetSeconds;
    this.startOffsetSeconds = options.startOffsetSeconds;
    this.loop = options.loop;
    this.onEnded = options.onEnded;
    this.onError = options.onError;
    this.element = document.createElement('video');
    this.element.className = 'ec-trailer';
    this.element.src = url;
    this.element.muted = options.muted;
    this.element.defaultMuted = options.muted;
    this.element.volume = Math.max(0, Math.min(1, options.volume / 100));
    this.element.loop = options.loop && options.endOffsetSeconds === 0;
    this.element.autoplay = true;
    this.element.playsInline = true;
    this.element.preload = 'auto';
    this.element.controls = false;
    this.element.disablePictureInPicture = true;
    this.element.tabIndex = -1;
    this.element.setAttribute('playsinline', '');
    this.element.setAttribute('webkit-playsinline', '');
    if (options.muted) this.element.setAttribute('muted', '');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.addEventListener('loadedmetadata', () => {
      if (options.startOffsetSeconds > 0 && options.startOffsetSeconds < this.element.duration) {
        this.element.currentTime = options.startOffsetSeconds;
      }
    });
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
    this.element.volume = Math.max(0, Math.min(1, volume / 100));
  }

  destroy(): void {
    this.destroyed = true;
    this.clearPlaybackWatchdog();
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

  private handleTimeUpdate = (): void => {
    this.clearPlaybackWatchdog();
    if (this.endOffsetSeconds <= 0 || !Number.isFinite(this.element.duration)) return;
    if (this.element.currentTime < this.element.duration - this.endOffsetSeconds) return;
    if (this.loop) {
      this.element.currentTime = this.startOffsetSeconds;
      void this.element.play().catch(() => undefined);
    } else {
      this.element.pause();
      this.handleEnded();
    }
  };

  private handleEnded = (): void => {
    if (this.ended) return;
    this.ended = true;
    this.clearPlaybackWatchdog();
    this.onEnded();
  };

  private armPlaybackWatchdog = (): void => {
    this.clearPlaybackWatchdog();
    this.playbackWatchdog = window.setTimeout(() => {
      this.playbackWatchdog = null;
      this.fail(new Error('Trailer playback stalled.'));
    }, 8000);
  };

  private clearPlaybackWatchdog = (): void => {
    if (this.playbackWatchdog !== null) window.clearTimeout(this.playbackWatchdog);
    this.playbackWatchdog = null;
  };

  private handleMediaError = (): void => {
    this.fail(new Error('Trailer media could not be played.'));
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

export class YouTubePlayer implements TrailerPlayer {
  readonly element: HTMLDivElement;
  private player: YouTubePlayerInstance | null = null;
  private attempt = 0;
  private endTimer: number | null = null;
  private revealTimer: number | null = null;
  private startupTimer: number | null = null;
  private destroyed = false;
  private failed = false;
  private readonly ready: Promise<void>;

  constructor(videoId: string, options: TrailerPlaybackOptions) {
    this.element = document.createElement('div');
    this.element.className = 'ec-trailer';
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-hidden', 'true');
    this.ready = this.initialize(videoId, options);
  }

  async play(): Promise<void> {
    await this.ready;
    this.player?.playVideo();
  }

  async pause(): Promise<void> {
    await this.ready;
    this.player?.pauseVideo();
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.ready;
    if (muted) this.player?.mute();
    else this.player?.unMute();
  }

  async setVolume(volume: number): Promise<void> {
    await this.ready;
    this.player?.setVolume(Math.max(0, Math.min(100, volume)));
  }

  destroy(): void {
    this.destroyed = true;
    if (this.endTimer !== null) window.clearInterval(this.endTimer);
    if (this.revealTimer !== null) window.clearTimeout(this.revealTimer);
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.player?.destroy();
    this.player = null;
    this.element.remove();
  }

  private async initialize(videoId: string, options: TrailerPlaybackOptions): Promise<void> {
    const api = await loadYouTubeApi();
    if (this.destroyed) return;
    this.startPlayer(api, videoId, options, 0);
  }

  private startPlayer(
    api: YouTubeApi,
    videoId: string,
    options: TrailerPlaybackOptions,
    hostIndex: number
  ): void {
    if (this.destroyed || this.failed) return;
    const hosts = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
    const attempt = ++this.attempt;
    const startupTimeoutMilliseconds = hostIndex === 0 ? 2500 : 8000;
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.player?.destroy();
    this.player = null;
    this.element.replaceChildren();
    const mount = document.createElement('div');
    this.element.appendChild(mount);
    this.startupTimer = window.setTimeout(() => {
      this.startupTimer = null;
      if (this.destroyed || attempt !== this.attempt) return;
      if (hostIndex + 1 < hosts.length) this.startPlayer(api, videoId, options, hostIndex + 1);
      else this.fail(options, new Error('YouTube trailer did not become ready in time.'));
    }, startupTimeoutMilliseconds);
    this.player = new api.Player(mount, {
      videoId,
      host: hosts[hostIndex],
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1, fs: 0, loop: options.loop ? 1 : 0,
        modestbranding: 1, mute: options.muted ? 1 : 0, playsinline: 1, rel: 0,
        origin: window.location.origin, start: options.startOffsetSeconds,
        playlist: options.loop ? videoId : undefined
      },
      events: {
        onReady: ({ target }) => {
          if (this.destroyed || attempt !== this.attempt) return;
          if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
          this.startupTimer = null;
          const iframe = target.getIframe();
          iframe.classList.add('ec-youtube-frame');
          iframe.tabIndex = -1;
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          iframe.setAttribute('aria-hidden', 'true');
          if (options.muted) target.mute(); else target.unMute();
          target.setVolume(options.volume);
          if (options.startOffsetSeconds > 0) target.seekTo(options.startOffsetSeconds, true);
          target.playVideo();
          if ((options.concealDurationMilliseconds ?? 0) > 0) {
            options.onConcealStart?.(options.concealDurationMilliseconds!);
            this.revealTimer = window.setTimeout(() => {
              this.revealTimer = null;
              if (!this.destroyed) options.onReveal?.();
            }, options.concealDurationMilliseconds);
          } else {
            options.onReveal?.();
          }
          if (options.endOffsetSeconds > 0) {
            this.endTimer = window.setInterval(() => {
              const duration = target.getDuration();
              if (duration > 0 && target.getCurrentTime() >= duration - options.endOffsetSeconds) {
                if (options.loop) target.seekTo(options.startOffsetSeconds, true);
                else {
                  if (this.endTimer !== null) window.clearInterval(this.endTimer);
                  this.endTimer = null;
                  target.pauseVideo();
                  options.onEnded();
                }
              }
            }, 250);
          }
        },
        onStateChange: ({ data }) => {
          if (this.destroyed || attempt !== this.attempt) return;
          if (data === 0 && !options.loop) options.onEnded();
        },
        onError: ({ data }) => {
          if (this.destroyed || attempt !== this.attempt) return;
          if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
          this.startupTimer = null;
          if (hostIndex + 1 < hosts.length) this.startPlayer(api, videoId, options, hostIndex + 1);
          else this.fail(options, new Error(`YouTube trailer failed with player error ${data}.`));
        }
      }
    });
  }

  private fail(options: TrailerPlaybackOptions, error: Error): void {
    if (this.destroyed || this.failed) return;
    this.failed = true;
    options.onError(error);
  }
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
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerInstance;
}

interface YouTubePlayerOptions {
  videoId: string;
  host: string;
  playerVars: Record<string, string | number | undefined>;
  events: {
    onReady: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
  };
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };
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
      8000
    );
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (youtubeWindow.YT?.Player) finish(youtubeWindow.YT);
      else finish(undefined, new Error('YouTube player API did not initialize.'));
    };
    if (!document.querySelector('script[data-ec-youtube-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.ecYoutubeApi = 'true';
      script.onerror = () => finish(undefined, new Error('YouTube player API could not be loaded.'));
      document.head.appendChild(script);
    }
  });
  youtubeApiPromise = pending;
  void pending.catch(() => {
    if (youtubeApiPromise === pending) youtubeApiPromise = null;
  });
  return pending;
}

export class ExternalPlayer {
  constructor(private readonly url: string) {}

  open(): void {
    window.open(this.url, '_blank', 'noopener,noreferrer');
  }
}

export function createTrailerPlayer(trailer: FeaturedTrailer, options: TrailerPlaybackOptions): TrailerPlayer | null {
  if (trailer.type === 'local' && trailer.itemId) {
    const url = localTrailerUrl(trailer.itemId);
    return url ? new JellyfinLocalPlayer(trailer.itemId, options) : null;
  }
  if (trailer.provider === 'youtube' && trailer.videoId) return new YouTubePlayer(trailer.videoId, options);
  if (trailer.provider === 'direct' && trailer.url) return new DirectVideoPlayer(trailer.url, options);
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
