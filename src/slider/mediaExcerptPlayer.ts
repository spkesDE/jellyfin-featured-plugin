import { getAccessToken, getApiClient, getCurrentUserId, requestJson } from '../core/apiClient';
import { createTrailerVideoElement } from './htmlVideoPlayer';
import type { TrailerPlaybackOptions, TrailerPlayer } from './trailerTypes';

const TICKS_PER_SECOND = 10_000_000;
const MAX_STREAMING_BITRATE = 120_000_000;
// Covers the PlaybackInfo round trip plus a transcode spinning up before the first frame.
const PLAYBACK_WATCHDOG_MS = 15_000;

interface PlaybackMediaSource {
  Id?: string | null;
  Container?: string | null;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  TranscodingUrl?: string | null;
}

interface PlaybackInfoResponse {
  MediaSources?: PlaybackMediaSource[] | null;
  PlaySessionId?: string | null;
  ErrorCode?: string | null;
}

export interface MediaExcerptStream {
  url: string;
  /** Position the element must seek to; transcodes already start at the excerpt offset. */
  seekSeconds: number;
  playSessionId: string | null;
  transcoding: boolean;
}

interface CodecProbe {
  codec: string;
  mime: string;
}

const MP4_VIDEO_CODECS: CodecProbe[] = [
  { codec: 'h264', mime: 'video/mp4; codecs="avc1.640029"' },
  { codec: 'hevc', mime: 'video/mp4; codecs="hvc1.1.6.L120.90"' },
  { codec: 'av1', mime: 'video/mp4; codecs="av01.0.08M.08"' },
  { codec: 'vp9', mime: 'video/mp4; codecs="vp09.00.10.08"' }
];
const MP4_AUDIO_CODECS: CodecProbe[] = [
  { codec: 'aac', mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'mp3', mime: 'audio/mpeg' },
  { codec: 'opus', mime: 'audio/mp4; codecs="opus"' },
  { codec: 'flac', mime: 'audio/mp4; codecs="flac"' },
  { codec: 'ac3', mime: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mime: 'audio/mp4; codecs="ec-3"' }
];
const WEBM_VIDEO_CODECS: CodecProbe[] = [
  { codec: 'vp8', mime: 'video/webm; codecs="vp8"' },
  { codec: 'vp9', mime: 'video/webm; codecs="vp9"' },
  { codec: 'av1', mime: 'video/webm; codecs="av01.0.08M.08"' }
];
const WEBM_AUDIO_CODECS: CodecProbe[] = [
  { codec: 'vorbis', mime: 'audio/webm; codecs="vorbis"' },
  { codec: 'opus', mime: 'audio/webm; codecs="opus"' }
];

function supported(video: HTMLVideoElement, probes: CodecProbe[]): string[] {
  return probes.filter((probe) => video.canPlayType(probe.mime).replace('no', '') !== '').map((probe) => probe.codec);
}

/**
 * Describes what this browser can play without help from hls.js. Anything else is remuxed or transcoded by
 * Jellyfin into a progressive fragmented MP4, which every supported browser can play from a plain video element.
 */
export function createExcerptDeviceProfile(video: HTMLVideoElement): Record<string, unknown> {
  const directPlayProfiles: Array<Record<string, string>> = [];
  const mp4Video = supported(video, MP4_VIDEO_CODECS);
  const mp4Audio = supported(video, MP4_AUDIO_CODECS);
  if (mp4Video.length) {
    directPlayProfiles.push({
      Container: 'mp4,m4v',
      Type: 'Video',
      VideoCodec: mp4Video.join(','),
      AudioCodec: mp4Audio.join(',')
    });
  }
  const webmVideo = supported(video, WEBM_VIDEO_CODECS);
  if (webmVideo.length) {
    directPlayProfiles.push({
      Container: 'webm',
      Type: 'Video',
      VideoCodec: webmVideo.join(','),
      AudioCodec: supported(video, WEBM_AUDIO_CODECS).join(',')
    });
  }

  return {
    Name: 'Featured media excerpt',
    MaxStreamingBitrate: MAX_STREAMING_BITRATE,
    MaxStaticBitrate: MAX_STREAMING_BITRATE,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: [
      {
        Container: 'mp4',
        Type: 'Video',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Protocol: 'http',
        Context: 'Streaming',
        MaxAudioChannels: '2'
      }
    ],
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: []
  };
}

/** Resolves the excerpt stream through Jellyfin's PlaybackInfo so user permissions and bitrate limits apply. */
export async function resolveMediaExcerptStream(
  itemId: string,
  startSeconds: number,
  video: HTMLVideoElement
): Promise<MediaExcerptStream> {
  const api = getApiClient();
  if (!api?.getUrl) throw new Error('Jellyfin API client is unavailable.');
  const startTimeTicks = Math.max(0, Math.round(startSeconds * TICKS_PER_SECOND));
  const info = await requestJson<PlaybackInfoResponse>(`Items/${encodeURIComponent(itemId)}/PlaybackInfo`, {
    method: 'POST',
    body: {
      UserId: getCurrentUserId(),
      MaxStreamingBitrate: MAX_STREAMING_BITRATE,
      StartTimeTicks: startTimeTicks,
      SubtitleStreamIndex: -1,
      EnableDirectPlay: true,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
      AutoOpenLiveStream: false,
      DeviceProfile: createExcerptDeviceProfile(video)
    }
  });
  const source = info.MediaSources?.[0];
  if (!source || info.ErrorCode)
    throw new Error(`Media excerpt is not playable${info.ErrorCode ? `: ${info.ErrorCode}` : '.'}`);
  const playSessionId = info.PlaySessionId || null;
  const token = getAccessToken();

  if (source.SupportsDirectPlay || source.SupportsDirectStream) {
    // No container suffix: Jellyfin lists MP4 as "mov,mp4,…", and the static stream derives its type from the file.
    const url = api.getUrl(`Videos/${encodeURIComponent(itemId)}/stream`, {
      Static: true,
      MediaSourceId: source.Id || itemId,
      PlaySessionId: playSessionId,
      DeviceId: api.deviceId?.(),
      api_key: token
    });
    if (!url) throw new Error('Media excerpt stream URL could not be resolved.');
    return { url, seekSeconds: startSeconds, playSessionId, transcoding: false };
  }

  if (source.TranscodingUrl) {
    const base = api.getUrl(source.TranscodingUrl.replace(/^\/+/, ''));
    if (!base) throw new Error('Media excerpt transcoding URL could not be resolved.');
    const url = new URL(base, window.location.href);
    const params = new Map([...url.searchParams.keys()].map((key) => [key.toLowerCase(), key]));
    if (!params.has('starttimeticks')) url.searchParams.set('StartTimeTicks', String(startTimeTicks));
    if (!params.has('api_key') && !params.has('apikey') && token) url.searchParams.set('api_key', token);
    return { url: url.toString(), seekSeconds: 0, playSessionId, transcoding: true };
  }

  throw new Error('Media excerpt has neither a direct stream nor a transcoding URL.');
}

/** Tells Jellyfin to drop the excerpt's transcode immediately instead of waiting for its idle timeout. */
export async function stopMediaExcerptEncoding(playSessionId: string): Promise<void> {
  const api = getApiClient();
  const url = api?.getUrl?.('Videos/ActiveEncodings', {
    DeviceId: api.deviceId?.(),
    PlaySessionId: playSessionId
  });
  if (!url) return;
  try {
    if (api?.ajax) await Promise.resolve(api.ajax({ type: 'DELETE', url }));
    else await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // The server also reaps abandoned progressive transcodes once the stream connection closes.
  }
}

/**
 * Plays a short segment of the item's own video. Progress is measured from the first played frame, so pausing
 * extends the excerpt and the same timing works for seeked direct streams and offset transcodes.
 */
export class MediaExcerptPlayer implements TrailerPlayer {
  readonly element: HTMLVideoElement;

  private readonly ready: Promise<void>;
  private readonly durationSeconds: number;
  private stream: MediaExcerptStream | null = null;
  private baselineSeconds: number | null = null;
  private watchdog: number | null = null;
  private destroyed = false;
  private finished = false;

  constructor(
    private readonly itemId: string,
    private readonly startSeconds: number,
    durationSeconds: number,
    private readonly options: TrailerPlaybackOptions
  ) {
    this.durationSeconds = Math.max(1, durationSeconds);
    this.element = createTrailerVideoElement('', { ...options, loop: false });
    this.element.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.element.addEventListener('timeupdate', this.handleTimeUpdate);
    this.element.addEventListener('playing', this.handlePlaying);
    this.element.addEventListener('ended', this.finish);
    this.element.addEventListener('waiting', this.armWatchdog);
    this.element.addEventListener('stalled', this.armWatchdog);
    this.element.addEventListener('error', this.handleMediaError);
    this.element.textTracks.addEventListener('addtrack', this.disableTextTracks);
    this.armWatchdog();
    this.ready = this.initialize();
    // play() surfaces resolution failures; this only keeps an unplayed excerpt from logging an unhandled rejection.
    this.ready.catch(() => undefined);
  }

  async play(): Promise<void> {
    await this.ready;
    if (this.destroyed || this.finished) return;
    await this.element.play();
  }

  async pause(): Promise<void> {
    this.element.pause();
  }

  async setMuted(muted: boolean): Promise<void> {
    this.element.muted = muted;
  }

  async setVolume(volume: number): Promise<void> {
    this.element.volume = Math.max(0, Math.min(100, volume)) / 100;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearWatchdog();
    this.element.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.element.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.element.removeEventListener('playing', this.handlePlaying);
    this.element.removeEventListener('ended', this.finish);
    this.element.removeEventListener('waiting', this.armWatchdog);
    this.element.removeEventListener('stalled', this.armWatchdog);
    this.element.removeEventListener('error', this.handleMediaError);
    this.element.textTracks.removeEventListener('addtrack', this.disableTextTracks);
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
    this.releaseServerStream();
  }

  private async initialize(): Promise<void> {
    const stream = await resolveMediaExcerptStream(this.itemId, this.startSeconds, this.element);
    this.stream = stream;
    if (this.destroyed) {
      this.releaseServerStream();
      return;
    }
    this.element.src = stream.url;
  }

  private releaseServerStream(): void {
    const stream = this.stream;
    if (!stream?.transcoding || !stream.playSessionId) return;
    this.stream = null;
    void stopMediaExcerptEncoding(stream.playSessionId);
  }

  private handleLoadedMetadata = (): void => {
    const seek = this.stream?.seekSeconds ?? 0;
    if (seek <= 0) return;
    const latest = Number.isFinite(this.element.duration) ? Math.max(0, this.element.duration - 1) : seek;
    this.element.currentTime = Math.min(seek, latest);
  };

  private handlePlaying = (): void => {
    this.clearWatchdog();
    this.captureBaseline();
  };

  private handleTimeUpdate = (): void => {
    if (this.destroyed || this.finished) return;
    if (!this.element.paused) this.clearWatchdog();
    this.captureBaseline();
    if (this.baselineSeconds === null) return;
    if (this.element.currentTime - this.baselineSeconds < this.durationSeconds) return;
    this.element.pause();
    this.finish();
  };

  private captureBaseline(): void {
    if (this.baselineSeconds !== null || this.element.seeking) return;
    this.baselineSeconds = this.element.currentTime;
  }

  private finish = (): void => {
    if (this.destroyed || this.finished) return;
    this.finished = true;
    this.clearWatchdog();
    this.releaseServerStream();
    this.options.onEnded();
  };

  private disableTextTracks = (): void => {
    for (let index = 0; index < this.element.textTracks.length; index++) {
      this.element.textTracks[index].mode = 'disabled';
    }
  };

  private handleMediaError = (): void => {
    // A cleared src during destroy also raises an error event; only report failures of a live excerpt.
    if (!this.element.getAttribute('src')) return;
    this.fail(new Error('Media excerpt could not be played.'));
  };

  private armWatchdog = (): void => {
    this.clearWatchdog();
    this.watchdog = window.setTimeout(
      () => this.fail(new Error('Media excerpt playback stalled.')),
      PLAYBACK_WATCHDOG_MS
    );
  };

  private clearWatchdog = (): void => {
    if (this.watchdog !== null) window.clearTimeout(this.watchdog);
    this.watchdog = null;
  };

  private fail(error: Error): void {
    if (this.destroyed || this.finished) return;
    this.finished = true;
    this.clearWatchdog();
    this.releaseServerStream();
    this.options.onError(error);
  }
}
