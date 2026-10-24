import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaExcerptPlayer, resolveMediaExcerptStream } from '../../src/slider/mediaExcerptPlayer';
import { createTrailerPlayer } from '../../src/slider/trailerFactory';
import type { TrailerPlaybackOptions } from '../../src/slider/trailerTypes';
import type { JellyfinAjaxRequest } from '../../src/types/jellyfin';

let playbackInfo: Record<string, unknown>;
let requests: JellyfinAjaxRequest[];

function getUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(`https://jellyfin.test/${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

beforeEach(() => {
  requests = [];
  playbackInfo = {};
  window.ApiClient = {
    accessToken: () => 'token',
    deviceId: () => 'device',
    getCurrentUserId: () => 'user',
    getUrl,
    ajax: vi.fn(async (request: JellyfinAjaxRequest) => {
      requests.push(request);
      return request.type === 'POST' ? playbackInfo : undefined;
    })
  };
});

afterEach(() => {
  delete window.ApiClient;
});

function createOptions(): TrailerPlaybackOptions {
  return {
    muted: true,
    volume: 50,
    startOffsetSeconds: 0,
    endOffsetSeconds: 0,
    loop: true,
    onEnded: vi.fn(),
    onError: vi.fn()
  };
}

function controlTime(element: HTMLVideoElement): { set(value: number): void } {
  let time = 0;
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    get: () => time,
    set: (value: number) => {
      time = value;
    }
  });
  Object.defineProperty(element, 'seeking', { configurable: true, get: () => false });
  Object.defineProperty(element, 'paused', { configurable: true, get: () => false });
  return {
    set(value: number) {
      time = value;
    }
  };
}

describe('resolveMediaExcerptStream', () => {
  it('uses a static stream and seeks when the browser can play the file', async () => {
    playbackInfo = {
      PlaySessionId: 'session',
      MediaSources: [{ Id: 'source', Container: 'mp4', SupportsDirectPlay: true }]
    };

    const stream = await resolveMediaExcerptStream('item', 420, document.createElement('video'));

    const body = JSON.parse(requests[0].data ?? '{}') as Record<string, unknown>;
    expect(requests[0].url).toContain('Items/item/PlaybackInfo');
    expect(body.StartTimeTicks).toBe(4_200_000_000);
    expect(body.SubtitleStreamIndex).toBe(-1);
    expect(body.UserId).toBe('user');
    expect(stream.transcoding).toBe(false);
    expect(stream.seekSeconds).toBe(420);
    const url = new URL(stream.url);
    expect(url.pathname).toBe('/Videos/item/stream');
    expect(url.searchParams.get('Static')).toBe('true');
    expect(url.searchParams.get('MediaSourceId')).toBe('source');
    expect(url.searchParams.get('PlaySessionId')).toBe('session');
  });

  it('falls back to the server transcode which already starts at the excerpt offset', async () => {
    playbackInfo = {
      PlaySessionId: 'session',
      MediaSources: [
        {
          Id: 'source',
          Container: 'mkv',
          SupportsDirectPlay: false,
          SupportsDirectStream: false,
          TranscodingUrl: '/videos/item/stream.mp4?DeviceId=device&PlaySessionId=session'
        }
      ]
    };

    const stream = await resolveMediaExcerptStream('item', 420, document.createElement('video'));

    expect(stream.transcoding).toBe(true);
    expect(stream.seekSeconds).toBe(0);
    const url = new URL(stream.url);
    expect(url.pathname).toBe('/videos/item/stream.mp4');
    expect(url.searchParams.get('StartTimeTicks')).toBe('4200000000');
    expect(url.searchParams.get('api_key')).toBe('token');
  });

  it('rejects items the server refuses to play', async () => {
    playbackInfo = { ErrorCode: 'NotAllowed', MediaSources: [{ Id: 'source' }] };

    await expect(resolveMediaExcerptStream('item', 0, document.createElement('video'))).rejects.toThrow('NotAllowed');
  });
});

describe('MediaExcerptPlayer', () => {
  it('is created for media-excerpt candidates', () => {
    playbackInfo = { MediaSources: [{ Id: 'source', Container: 'mp4', SupportsDirectPlay: true }] };
    const player = createTrailerPlayer(
      { type: 'local', provider: 'media-excerpt', itemId: 'item', startSeconds: 300, durationSeconds: 30 },
      createOptions()
    );

    expect(player).toBeInstanceOf(MediaExcerptPlayer);
    player?.destroy();
  });

  it('ends after the configured duration and stops the server transcode', async () => {
    playbackInfo = {
      PlaySessionId: 'session',
      MediaSources: [{ Id: 'source', TranscodingUrl: '/videos/item/stream.mp4?PlaySessionId=session' }]
    };
    const options = createOptions();
    const player = new MediaExcerptPlayer('item', 300, 30, options);
    const time = controlTime(player.element);
    vi.spyOn(player.element, 'play').mockResolvedValue(undefined);
    vi.spyOn(player.element, 'pause').mockImplementation(() => undefined);

    await player.play();
    time.set(0.5);
    player.element.dispatchEvent(new Event('playing'));
    time.set(20);
    player.element.dispatchEvent(new Event('timeupdate'));
    expect(options.onEnded).not.toHaveBeenCalled();

    time.set(30.5);
    player.element.dispatchEvent(new Event('timeupdate'));
    await Promise.resolve();

    expect(options.onEnded).toHaveBeenCalledOnce();
    const stop = requests.find((request) => request.type === 'DELETE');
    expect(stop?.url).toContain('Videos/ActiveEncodings');
    expect(new URL(stop!.url).searchParams.get('PlaySessionId')).toBe('session');
    player.destroy();
    expect(requests.filter((request) => request.type === 'DELETE')).toHaveLength(1);
  });

  it('seeks direct streams to the excerpt start and stops encodings when the slide changes', async () => {
    playbackInfo = {
      PlaySessionId: 'session',
      MediaSources: [{ Id: 'source', Container: 'mp4', SupportsDirectStream: true }]
    };
    const options = createOptions();
    const player = new MediaExcerptPlayer('item', 300, 30, options);
    const time = controlTime(player.element);
    vi.spyOn(player.element, 'play').mockResolvedValue(undefined);

    await player.play();
    player.element.dispatchEvent(new Event('loadedmetadata'));
    player.element.dispatchEvent(new Event('playing'));
    time.set(329);
    player.element.dispatchEvent(new Event('timeupdate'));

    expect(options.onEnded).not.toHaveBeenCalled();
    player.destroy();
    // Direct streams have no server-side encoding to stop.
    expect(requests.some((request) => request.type === 'DELETE')).toBe(false);
  });

  it('releases a transcode that was resolved after the slide already changed', async () => {
    playbackInfo = {
      PlaySessionId: 'session',
      MediaSources: [{ Id: 'source', TranscodingUrl: '/videos/item/stream.mp4' }]
    };
    const player = new MediaExcerptPlayer('item', 300, 30, createOptions());
    player.destroy();
    await vi.waitFor(() => expect(requests.some((request) => request.type === 'DELETE')).toBe(true));
    expect(player.element.getAttribute('src')).toBeNull();
  });
});
