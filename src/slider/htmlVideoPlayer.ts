import { getAccessToken, getApiClient } from '../core/apiClient';
import { clamp, type TrailerPlaybackOptions, type TrailerPlayer } from './trailerTypes';

export function localTrailerUrl(trailerId: string): string {
  const api = getApiClient();
  const token = getAccessToken();
  return (
    api?.getUrl?.(`Videos/${encodeURIComponent(trailerId)}/stream`, {
      Static: true,
      MediaSourceId: trailerId,
      DeviceId: api.deviceId?.(),
      api_key: token
    }) ?? ''
  );
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

  protected constructor(url: string, options: TrailerPlaybackOptions, disableSubtitles = false) {
    this.startOffsetSeconds = options.startOffsetSeconds;
    this.endOffsetSeconds = options.endOffsetSeconds;
    this.loop = options.loop;
    this.startFraction = options.startFraction;
    this.maximumDurationSeconds = options.maximumDurationSeconds;
    this.onEnded = options.onEnded;
    this.onError = options.onError;

    this.element = document.createElement('video');
    this.element.className = 'featured-trailer';
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
    const previewEnd =
      this.maximumDurationSeconds && this.maximumDurationSeconds > 0
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
    this.playbackWatchdog = window.setTimeout(() => this.fail(new Error('Trailer playback stalled.')), 8000);
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
    super(
      localMediaPreviewUrl(itemId),
      {
        ...options,
        startFraction: 0.2,
        maximumDurationSeconds: 30,
        loop: false
      },
      true
    );
  }
}

export class DirectVideoPlayer extends HtmlVideoPlayer {
  constructor(url: string, options: TrailerPlaybackOptions) {
    super(url, options, true);
  }
}

export function localMediaPreviewUrl(itemId: string): string {
  const api = getApiClient();
  const token = getAccessToken();
  return (
    api?.getUrl?.(`Videos/${encodeURIComponent(itemId)}/stream`, {
      Static: true,
      DeviceId: api.deviceId?.(),
      ApiKey: token
    }) ?? ''
  );
}
