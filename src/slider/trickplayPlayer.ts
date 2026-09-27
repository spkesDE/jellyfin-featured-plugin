import { getAccessToken, getApiClient, getCurrentUserId, requestJson } from '../core/apiClient';
import type { TrailerPlaybackOptions, TrailerPlayer } from './trailerTypes';

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
  return (
    Number(info.TileWidth ?? info.tileWidth) > 0 &&
    Number(info.TileHeight ?? info.tileHeight) > 0 &&
    Number(info.ThumbnailCount ?? info.thumbnailCount) > 0
  );
}

function findTrickplayLeaves(value: unknown, path: string[] = []): Array<{ path: string[]; info: TrickplayInfo }> {
  if (isTrickplayInfo(value)) return [{ path, info: value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    findTrickplayLeaves(child, [...path, key])
  );
}

export class TrickplayPlayer implements TrailerPlayer {
  readonly element: HTMLDivElement;

  private readonly ready: Promise<void>;
  private info: ResolvedTrickplay | null = null;
  private timer: number | null = null;
  private frame = 0;
  private destroyed = false;

  constructor(
    private readonly itemId: string,
    private readonly options: TrailerPlaybackOptions
  ) {
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

  async setMuted(_muted: boolean): Promise<void> {}

  async setVolume(_volume: number): Promise<void> {}

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
      .map(({ path, info }) =>
        this.resolveInfo(
          mediaSourceIds.find((id) => path.some((key) => key.toLowerCase() === id.toLowerCase())) ?? mediaSourceIds[0],
          path.find((key) => Number.isFinite(Number(key)) && Number(key) > 0),
          info
        )
      )
      .filter((value): value is ResolvedTrickplay => value !== null);
    this.info = candidates.sort((left, right) => right.width - left.width)[0] ?? null;
    if (!this.info) throw new Error('No generated Trickplay images are available.');
    const startFrame = Math.floor((Math.max(0, this.options.startOffsetSeconds) * 1000) / this.info.interval);
    this.frame = Math.min(startFrame, this.info.thumbnailCount - 1);
  }

  private resolveInfo(
    mediaSourceId: string | undefined,
    resolution: string | undefined,
    raw: TrickplayInfo
  ): ResolvedTrickplay | null {
    const width = Number(raw.Width ?? raw.width ?? resolution);
    const height = Number(raw.Height ?? raw.height ?? Math.round((width * 9) / 16));
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
    const url = api?.getUrl?.(`Videos/${encodeURIComponent(this.itemId)}/Trickplay/${info.width}/${tileIndex}.jpg`, {
      mediaSourceId: info.mediaSourceId,
      ApiKey: getAccessToken()
    });
    if (!url) throw new Error('Could not resolve the Trickplay tile URL.');
    const bounds = this.element.getBoundingClientRect();
    const viewportWidth = bounds.width || window.innerWidth || info.width;
    const viewportHeight = bounds.height || Math.round((viewportWidth * info.height) / info.width);
    const scale = Math.max(viewportWidth / info.width, viewportHeight / info.height);
    const renderedFrameWidth = info.width * scale;
    const renderedFrameHeight = info.height * scale;
    const cropOffsetX = (renderedFrameWidth - viewportWidth) / 2;
    const cropOffsetY = (renderedFrameHeight - viewportHeight) / 2;
    const offsetX = -(column * renderedFrameWidth + cropOffsetX);
    const offsetY = -(row * renderedFrameHeight + cropOffsetY);
    this.element.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    this.element.style.backgroundSize = `${renderedFrameWidth * info.columns}px ${renderedFrameHeight * info.rows}px`;
    this.element.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }
}
