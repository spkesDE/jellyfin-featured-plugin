import { getAccessToken, getApiClient, getCurrentUserId, requestJson } from '../core/apiClient';
import { replaceElementChildren } from '../core/dom';
import type { FeaturedTrailer } from '../types/featured';

export interface TrailerPlaybackOptions {
  muted: boolean;
  volume: number;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  loop: boolean;
  onEnded: () => void;
  onError: (error: Error) => void;
  startFraction?: number;
  maximumDurationSeconds?: number;
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
  private readonly startFraction?: number;
  private readonly maximumDurationSeconds?: number;
  private readonly onEnded: () => void;
  private readonly onError: (error: Error) => void;
  private playbackWatchdog: number | null = null;
  private destroyed = false;
  private ended = false;
  private failed = false;
  private playbackStartSeconds = 0;

  protected constructor(
    url: string,
    options: TrailerPlaybackOptions,
    disableSubtitles = false
  ) {
    this.startOffsetSeconds = options.startOffsetSeconds;
    this.endOffsetSeconds = options.endOffsetSeconds;
    this.loop = options.loop;
    this.startFraction = options.startFraction;
    this.maximumDurationSeconds = options.maximumDurationSeconds;
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
    if (disableSubtitles) {
      this.element.textTracks.addEventListener('addtrack', this.disableTextTracks);
      this.disableTextTracks();
    }
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
    this.element.textTracks.removeEventListener('addtrack', this.disableTextTracks);

    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
  }

  private handleLoadedMetadata = (): void => {
    if (!Number.isFinite(this.element.duration)) return;
    const fractionalStart = Number.isFinite(this.startFraction)
      ? this.element.duration * clamp(this.startFraction ?? 0, 0, 1)
      : this.startOffsetSeconds;
    this.playbackStartSeconds = clamp(fractionalStart, 0, Math.max(0, this.element.duration - 0.1));
    if (this.playbackStartSeconds > 0) this.element.currentTime = this.playbackStartSeconds;
  };

  private disableTextTracks = (): void => {
    for (let index = 0; index < this.element.textTracks.length; index++) {
      this.element.textTracks[index].mode = 'disabled';
    }
  };

  private handleTimeUpdate = (): void => {
    this.clearPlaybackWatchdog();
    if (!Number.isFinite(this.element.duration)) return;
    const naturalEnd = this.element.duration - Math.max(0, this.endOffsetSeconds);
    const previewEnd = this.maximumDurationSeconds && this.maximumDurationSeconds > 0
      ? this.playbackStartSeconds + this.maximumDurationSeconds
      : Number.POSITIVE_INFINITY;
    const playbackEnd = Math.min(naturalEnd, previewEnd);
    if (!Number.isFinite(playbackEnd) || this.element.currentTime < playbackEnd) return;

    if (this.loop) {
      this.element.currentTime = this.playbackStartSeconds;
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

export class JellyfinMediaPreviewPlayer extends HtmlVideoPlayer {
  constructor(itemId: string, options: TrailerPlaybackOptions) {
    super(localMediaPreviewUrl(itemId), {
      ...options,
      startFraction: 0.2,
      maximumDurationSeconds: 30,
      loop: false
    }, true);
  }
}

export class DirectVideoPlayer extends HtmlVideoPlayer {
  constructor(url: string, options: TrailerPlaybackOptions) {
    super(url, options, true);
  }
}

function localMediaPreviewUrl(itemId: string): string {
  const api = getApiClient();
  const token = getAccessToken();
  return api?.getUrl?.(`Videos/${encodeURIComponent(itemId)}/stream`, {
    Static: true,
    DeviceId: api.deviceId?.(),
    ApiKey: token
  }) ?? '';
}

interface TrickplayInfo {
  Width?: number;
  width?: number;
  Height?: number;
  height?: number;
  TileWidth?: number;
  tileWidth?: number;
  TileHeight?: number;
  tileHeight?: number;
  ThumbnailCount?: number;
  thumbnailCount?: number;
  Interval?: number;
  interval?: number;
}

interface TrickplayItemResponse {
  Id?: string;
  MediaSources?: Array<{ Id?: string }>;
  mediaSources?: Array<{ id?: string }>;
  Trickplay?: Record<string, Record<string, TrickplayInfo>>;
  trickplay?: Record<string, Record<string, TrickplayInfo>>;
}

interface ResolvedTrickplay {
  mediaSourceId?: string;
  width: number;
  height: number;
  columns: number;
  rows: number;
  thumbnailCount: number;
  interval: number;
}

const TRICKPLAY_FRAME_DURATION_MS = 500;

function isTrickplayInfo(value: unknown): value is TrickplayInfo {
  if (!value || typeof value !== 'object') return false;
  const info = value as TrickplayInfo;
  return Number(info.TileWidth ?? info.tileWidth) > 0
    && Number(info.TileHeight ?? info.tileHeight) > 0
    && Number(info.ThumbnailCount ?? info.thumbnailCount) > 0;
}

function findTrickplayLeaves(value: unknown, path: string[] = []): Array<{ path: string[]; info: TrickplayInfo }> {
  if (isTrickplayInfo(value)) return [{ path, info: value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => findTrickplayLeaves(child, [...path, key]));
}

export class TrickplayPlayer implements TrailerPlayer {
  readonly element: HTMLDivElement;

  private readonly ready: Promise<void>;
  private info: ResolvedTrickplay | null = null;
  private timer: number | null = null;
  private frame = 0;
  private destroyed = false;

  constructor(private readonly itemId: string, private readonly options: TrailerPlaybackOptions) {
    this.element = document.createElement('div');
    this.element.className = 'ec-trailer ec-trickplay';
    this.element.tabIndex = -1;
    this.element.setAttribute('aria-hidden', 'true');
    this.ready = this.initialize();
  }

  async play(): Promise<void> {
    await this.ready;
    if (this.destroyed || this.timer !== null) return;
    this.renderFrame();
    this.timer = window.setInterval(() => this.advance(), TRICKPLAY_FRAME_DURATION_MS);
  }

  async pause(): Promise<void> {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  async setMuted(_muted: boolean): Promise<void> { }

  async setVolume(_volume: number): Promise<void> { }

  destroy(): void {
    this.destroyed = true;
    void this.pause();
    this.element.remove();
  }

  private async initialize(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Could not resolve the active user for Trickplay.');
    const item = await requestJson<TrickplayItemResponse>(
      `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(this.itemId)}`,
      { query: { Fields: 'Trickplay,MediaSources' } }
    );
    const manifest = item.Trickplay ?? item.trickplay ?? {};
    const mediaSourceIds = [
      ...(item.MediaSources ?? []).map((source) => source.Id),
      ...(item.mediaSources ?? []).map((source) => source.id)
    ].filter((value): value is string => Boolean(value));
    const candidates = findTrickplayLeaves(manifest)
      .map(({ path, info }) => this.resolveInfo(
        mediaSourceIds.find((id) => path.some((key) => key.toLowerCase() === id.toLowerCase()))
          ?? mediaSourceIds[0],
        path.find((key) => Number.isFinite(Number(key)) && Number(key) > 0),
        info
      ))
      .filter((value): value is ResolvedTrickplay => value !== null);
    this.info = candidates.sort((left, right) => right.width - left.width)[0] ?? null;
    if (!this.info) throw new Error('No generated Trickplay images are available.');
    const startFrame = Math.floor((Math.max(0, this.options.startOffsetSeconds) * 1000) / this.info.interval);
    this.frame = Math.min(startFrame, this.info.thumbnailCount - 1);
  }

  private resolveInfo(mediaSourceId: string | undefined, resolution: string | undefined, raw: TrickplayInfo): ResolvedTrickplay | null {
    const width = Number(raw.Width ?? raw.width ?? resolution);
    const height = Number(raw.Height ?? raw.height ?? Math.round(width * 9 / 16));
    const columns = Number(raw.TileWidth ?? raw.tileWidth);
    const rows = Number(raw.TileHeight ?? raw.tileHeight);
    const thumbnailCount = Number(raw.ThumbnailCount ?? raw.thumbnailCount);
    const interval = Number(raw.Interval ?? raw.interval ?? 10_000);
    if (![width, height, columns, rows, thumbnailCount].every((value) => Number.isFinite(value) && value > 0)) {
      return null;
    }
    return { mediaSourceId, width, height, columns, rows, thumbnailCount, interval: Math.max(1, interval) };
  }

  private advance(): void {
    const info = this.info;
    if (!info || this.destroyed) return;
    const endFrames = Math.floor((Math.max(0, this.options.endOffsetSeconds) * 1000) / info.interval);
    const lastFrame = Math.max(0, info.thumbnailCount - 1 - endFrames);
    if (this.frame >= lastFrame) {
      if (!this.options.loop) {
        void this.pause();
        this.options.onEnded();
        return;
      }
      this.frame = Math.min(
        Math.floor((Math.max(0, this.options.startOffsetSeconds) * 1000) / info.interval),
        lastFrame
      );
    } else {
      this.frame += 1;
    }
    this.renderFrame();
  }

  private renderFrame(): void {
    const info = this.info;
    if (!info) return;
    const framesPerTile = info.columns * info.rows;
    const tileIndex = Math.floor(this.frame / framesPerTile);
    const frameInTile = this.frame % framesPerTile;
    const column = frameInTile % info.columns;
    const row = Math.floor(frameInTile / info.columns);
    const api = getApiClient();
    const url = api?.getUrl?.(
      `Videos/${encodeURIComponent(this.itemId)}/Trickplay/${info.width}/${tileIndex}.jpg`,
      { mediaSourceId: info.mediaSourceId, ApiKey: getAccessToken() }
    );
    if (!url) throw new Error('Could not resolve the Trickplay tile URL.');
    const bounds = this.element.getBoundingClientRect();
    const viewportWidth = bounds.width || window.innerWidth || info.width;
    const viewportHeight = bounds.height || Math.round(viewportWidth * info.height / info.width);
    const scale = Math.max(viewportWidth / info.width, viewportHeight / info.height);
    const renderedFrameWidth = info.width * scale;
    const renderedFrameHeight = info.height * scale;
    const cropOffsetX = (renderedFrameWidth - viewportWidth) / 2;
    const cropOffsetY = (renderedFrameHeight - viewportHeight) / 2;
    const offsetX = -((column * renderedFrameWidth) + cropOffsetX);
    const offsetY = -((row * renderedFrameHeight) + cropOffsetY);
    this.element.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    this.element.style.backgroundSize = `${renderedFrameWidth * info.columns}px ${renderedFrameHeight * info.rows}px`;
    this.element.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
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
    replaceElementChildren(this.element);
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
  if (trailer.provider === 'trickplay' && trailer.itemId) {
    return new TrickplayPlayer(trailer.itemId, options);
  }
  if (trailer.provider === 'media-preview' && trailer.itemId) {
    const url = localMediaPreviewUrl(trailer.itemId);
    return url ? new JellyfinMediaPreviewPlayer(trailer.itemId, options) : null;
  }
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
