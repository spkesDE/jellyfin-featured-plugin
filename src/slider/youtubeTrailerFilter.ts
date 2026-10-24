import { requestJson } from '../core/apiClient';
import type { FeaturedTrailer } from '../types/featured';

/** Only a confirmed SD result skips a candidate. Detection and caching belong to the server. */
export async function shouldSkipYouTubeTrailer(trailer: FeaturedTrailer): Promise<boolean> {
  if (trailer.provider !== 'youtube' || !trailer.youTubeQualityFilterEnabled || !trailer.videoId) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      requestJson<{ quality?: string }>(`featured/trailers/youtube/${encodeURIComponent(trailer.videoId)}/quality`),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 4500);
      })
    ]);
    return result?.quality === 'sd';
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
