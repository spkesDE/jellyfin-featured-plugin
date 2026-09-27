import type { FeaturedTrailer } from '../types/featured';
import {
  DirectVideoPlayer,
  JellyfinLocalPlayer,
  JellyfinMediaPreviewPlayer,
  localMediaPreviewUrl,
  localTrailerUrl
} from './htmlVideoPlayer';
import { TrickplayPlayer } from './trickplayPlayer';
import type { TrailerPlaybackOptions, TrailerPlayer } from './trailerTypes';
import { YouTubePlayer } from './youtubePlayer';

export class ExternalPlayer {
  constructor(private readonly url: string) {}

  open(): void {
    window.open(this.url, '_blank', 'noopener,noreferrer');
  }
}

export function createTrailerPlayer(trailer: FeaturedTrailer, options: TrailerPlaybackOptions): TrailerPlayer | null {
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
  return (
    window.matchMedia?.('(max-width: 767px)').matches ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}
