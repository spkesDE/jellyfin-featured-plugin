import { replaceElementChildren } from '../core/dom';
import { asError, clamp, type TrailerPlaybackOptions, type TrailerPlayer } from './trailerTypes';

const YOUTUBE_HOSTS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'] as const;
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
    replaceElementChildren(this.element);
    this.element.remove();
    this.resolveReadyOnce();
  }

  private async initialize(videoId: string, options: TrailerPlaybackOptions): Promise<void> {
    try {
      const api = await loadYouTubeApi();
      if (!this.destroyed && !this.failed) {
        this.startPlayer(api, videoId, options, 0);
      }
    } catch (error) {
      this.fail(options, asError(error, 'YouTube player API could not be loaded.'));
    }
  }

  private startPlayer(api: YouTubeApi, videoId: string, options: TrailerPlaybackOptions, hostIndex: number): void {
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
    replaceElementChildren(this.element);

    const iframe = document.createElement('iframe');
    iframe.id = `ec-youtube-player-${++youtubePlayerSequence}`;
    iframe.className = 'ec-youtube-frame';
    iframe.tabIndex = -1;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'YouTube trailer');
    iframe.src = createYouTubeEmbedUrl(host, videoId, options);

    const isCurrent = (): boolean => !this.destroyed && !this.failed && attempt === this.attempt;

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

    iframe.addEventListener(
      'load',
      () => {
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
                  playerIframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                  playerIframe.setAttribute('aria-hidden', 'true');
                  disableYouTubeCaptions(target);

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
                  if (data === 1 || data === 3) disableYouTubeCaptions(this.player);
                  if (data === 1 || data === 3) confirmPlayback();
                  if (data === 0 && !options.loop) options.onEnded();
                },
                onError: ({ data }) => {
                  if (!isCurrent()) return;

                  const error = new Error(`YouTube trailer failed with player error ${data}.`);

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
      },
      { once: true }
    );

    iframe.addEventListener(
      'error',
      () => {
        recover(new Error(`YouTube iframe failed to load from ${host}.`));
      },
      { once: true }
    );

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
      if (duration <= 0 || target.getCurrentTime() < duration - options.endOffsetSeconds) {
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

function createYouTubeEmbedUrl(host: string, videoId: string, options: TrailerPlaybackOptions): string {
  const url = new URL(`/embed/${encodeURIComponent(videoId)}`, `${host}/`);
  const params: Record<string, string | number | undefined> = {
    autoplay: 1,
    cc_load_policy: 0,
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

interface YouTubePlayerInstance {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setOption(module: string, option: string, value: unknown): void;
  setVolume(volume: number): void;
  unMute(): void;
}

function disableYouTubeCaptions(player: YouTubePlayerInstance | null): void {
  try {
    // An empty caption track explicitly overrides YouTube account preferences.
    player?.setOption('captions', 'track', {});
  } catch {
    // Some embedded-player versions do not expose the captions module.
  }
}

interface YouTubeApi {
  Player: new (element: string | HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerInstance;
}

interface YouTubePlayerOptions {
  events: {
    onReady: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange: (event: { data: number; target: YouTubePlayerInstance }) => void;
    onError: (event: { data: number }) => void;
  };
}
