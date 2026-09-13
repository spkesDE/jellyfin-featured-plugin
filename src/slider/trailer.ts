import { getAccessToken, getApiClient } from '../core/apiClient';
import type { FeaturedTrailer } from '../types/featured';

export interface TrailerPlaybackOptions {
  muted: boolean;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  loop: boolean;
  onEnded: () => void;
  concealDurationMilliseconds?: number;
  onConcealStart?: (durationMilliseconds: number) => void;
  onReveal?: () => void;
}

export interface TrailerPlayer {
  readonly element: HTMLElement;
  play(): Promise<void>;
  pause(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
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
  private ended = false;

  protected constructor(url: string, options: TrailerPlaybackOptions) {
    this.endOffsetSeconds = options.endOffsetSeconds;
    this.startOffsetSeconds = options.startOffsetSeconds;
    this.loop = options.loop;
    this.onEnded = options.onEnded;
    this.element = document.createElement('video');
    this.element.className = 'ec-trailer';
    this.element.src = url;
    this.element.muted = options.muted;
    this.element.loop = options.loop && options.endOffsetSeconds === 0;
    this.element.autoplay = true;
    this.element.playsInline = true;
    this.element.controls = false;
    this.element.disablePictureInPicture = true;
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.addEventListener('loadedmetadata', () => {
      if (options.startOffsetSeconds > 0 && options.startOffsetSeconds < this.element.duration) {
        this.element.currentTime = options.startOffsetSeconds;
      }
    });
    this.element.addEventListener('timeupdate', this.handleTimeUpdate);
    this.element.addEventListener('ended', this.handleEnded);
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

  destroy(): void {
    this.element.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.element.removeEventListener('ended', this.handleEnded);
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
  }

  private handleTimeUpdate = (): void => {
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
    this.onEnded();
  };
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
  private endTimer: number | null = null;
  private revealTimer: number | null = null;
  private destroyed = false;
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

  destroy(): void {
    this.destroyed = true;
    if (this.endTimer !== null) window.clearInterval(this.endTimer);
    if (this.revealTimer !== null) window.clearTimeout(this.revealTimer);
    this.player?.destroy();
    this.player = null;
    this.element.remove();
  }

  private async initialize(videoId: string, options: TrailerPlaybackOptions): Promise<void> {
    const api = await loadYouTubeApi();
    if (this.destroyed) return;
    this.player = new api.Player(this.element, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1, fs: 0, loop: options.loop ? 1 : 0,
        modestbranding: 1, mute: options.muted ? 1 : 0, playsinline: 1, rel: 0,
        start: options.startOffsetSeconds, playlist: options.loop ? videoId : undefined
      },
      events: {
        onReady: ({ target }) => {
          const iframe = target.getIframe();
          iframe.classList.add('ec-trailer');
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          if (options.muted) target.mute(); else target.unMute();
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
          if (data === 0 && !options.loop) options.onEnded();
        }
      }
    });
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
  };
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT);
      else reject(new Error('YouTube player API did not initialize.'));
    };
    if (!document.querySelector('script[data-ec-youtube-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.ecYoutubeApi = 'true';
      script.onerror = () => reject(new Error('YouTube player API could not be loaded.'));
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
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
