import { CONSOLE_PREFIX } from '../constants';
import { requestJson } from '../core/apiClient';
import { getFeaturedCacheScope, updateFeaturedCache } from '../core/featuredCache';
import { invalidatePreferencesBootstrap } from '../preferencesApi';
import type { FeaturedResponse } from '../types/featured';

const SAVE_DELAY_MS = 300;

export interface TrailerAudioChange {
  muted?: boolean;
  volume?: number;
}

let session: { scope: string | null; audio: TrailerAudioChange } | null = null;
let pending: { scope: string | null; audio: TrailerAudioChange; timer: number } | null = null;
let inFlight: Promise<void> | null = null;

function applyAudio(response: FeaturedResponse, audio: TrailerAudioChange): FeaturedResponse {
  const muted = audio.muted ?? response.startTrailersMuted;
  const volume = audio.volume ?? response.trailerVolume;
  return muted === response.startTrailersMuted && volume === response.trailerVolume
    ? response
    : { ...response, startTrailersMuted: muted, trailerVolume: volume };
}

/** Applies newer in-session audio choices to a response that may have been fetched before they were saved. */
export function withSessionTrailerAudio(response: FeaturedResponse): FeaturedResponse {
  return session && session.scope === getFeaturedCacheScope() ? applyAudio(response, session.audio) : response;
}

export function forgetSessionTrailerAudio(): void {
  session = null;
  if (pending) window.clearTimeout(pending.timer);
  pending = null;
}

function flush(): Promise<void> {
  if (!pending) return inFlight ?? Promise.resolve();
  window.clearTimeout(pending.timer);
  const { audio } = pending;
  pending = null;
  // Saves run one after another so an older change can never land after a newer one.
  const request: Promise<void> = (inFlight ?? Promise.resolve())
    .then(() => requestJson('featured/preferences/trailer-audio', { method: 'PUT', body: audio }))
    .then(() => invalidatePreferencesBootstrap())
    .catch((error: unknown) => console.warn(`${CONSOLE_PREFIX} Could not remember the trailer audio settings.`, error))
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

/**
 * Sends any waiting change now and resolves once every save has finished, so the settings dialog
 * loads the profile only after it contains the latest mute and volume.
 */
export function flushTrailerAudio(): Promise<void> {
  return flush();
}

/**
 * Remembers trailer mute and volume changes for this page session and, with `persist`, in the user's profile.
 * Slider drags and rapid toggles collapse into one request, and the cached carousel response is patched so the
 * next cached render already agrees. Without `persist` nothing outlives a reload, so the saved defaults return.
 */
export function rememberTrailerAudio(change: TrailerAudioChange, { persist = true }: { persist?: boolean } = {}): void {
  const scope = getFeaturedCacheScope();
  const base = session?.scope === scope ? session.audio : {};
  session = { scope, audio: { ...base, ...change } };
  if (!persist) return;
  updateFeaturedCache((response) => applyAudio(response, change));

  if (pending && pending.scope !== scope) void flush();
  if (pending) window.clearTimeout(pending.timer);
  pending = {
    scope,
    audio: { ...(pending?.audio ?? {}), ...change },
    timer: window.setTimeout(() => void flush(), SAVE_DELAY_MS)
  };
}
