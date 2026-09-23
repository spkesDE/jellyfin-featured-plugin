import { getApiClient, getCurrentUserId, requestJson } from '../core/apiClient';
import { t } from '../i18n';
import type { FeaturedItem } from '../types/featured';
import { openItemDetails } from './navigation';

interface JellyfinPlaybackItem {
  Id: string;
  Name?: string;
  Type?: string;
  MediaType?: string;
  ServerId?: string;
  IsFolder?: boolean;
  UserData?: {
    PlaybackPositionTicks?: number;
  };
}

interface JellyfinQueryResult {
  Items?: JellyfinPlaybackItem[];
}

interface PlaybackTarget {
  id: string;
  name: string;
  type: string;
  mediaType: string;
  serverId: string;
  isFolder: boolean;
  positionTicks: number;
}

const playbackTargets = new Map<string, Promise<PlaybackTarget>>();

function asTarget(item: JellyfinPlaybackItem, fallback: FeaturedItem): PlaybackTarget {
  const positionTicks = Math.max(0, Number(item.UserData?.PlaybackPositionTicks) || 0);
  return {
    id: item.Id,
    name: item.Name || fallback.name,
    type: item.Type || fallback.mediaType,
    mediaType: item.MediaType || (fallback.mediaType === 'Photo' ? 'Photo' : 'Video'),
    serverId: item.ServerId || getApiClient()?.serverId?.() || '',
    isFolder: item.IsFolder === true,
    positionTicks
  };
}

async function resolveSeriesTarget(item: FeaturedItem, userId: string): Promise<JellyfinPlaybackItem> {
  const query = {
    userId,
    seriesId: item.id,
    limit: 1,
    enableResumable: true,
    enableTotalRecordCount: false,
    enableUserData: true,
    fields: 'MediaSources'
  };
  const nextUp = await requestJson<JellyfinQueryResult>('Shows/NextUp', { query });
  if (nextUp.Items?.[0]) return nextUp.Items[0];

  const episodes = await requestJson<JellyfinQueryResult>(`Shows/${encodeURIComponent(item.id)}/Episodes`, {
    query: {
      userId,
      limit: 1,
      isMissing: false,
      isVirtualUnaired: false,
      enableTotalRecordCount: false,
      enableUserData: true,
      fields: 'MediaSources'
    }
  });
  if (episodes.Items?.[0]) return episodes.Items[0];
  throw new Error(`No playable episode found for ${item.name}`);
}

async function fetchPlaybackTarget(item: FeaturedItem): Promise<PlaybackTarget> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('No active Jellyfin user');

  const resolved = item.mediaType === 'Series'
    ? await resolveSeriesTarget(item, userId)
    : await requestJson<JellyfinPlaybackItem>(
        `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(item.id)}`
      );
  return asTarget(resolved, item);
}

function resolvePlaybackTarget(item: FeaturedItem, refresh = false): Promise<PlaybackTarget> {
  const key = `${getCurrentUserId() || ''}:${item.id}`;
  if (refresh) playbackTargets.delete(key);
  let target = playbackTargets.get(key);
  if (!target) {
    target = fetchPlaybackTarget(item).catch((error) => {
      playbackTargets.delete(key);
      throw error;
    });
    playbackTargets.set(key, target);
  }
  return target;
}

function createNativePlaybackAction(target: PlaybackTarget): HTMLButtonElement {
  const action = document.createElement('button');
  action.type = 'button';
  action.hidden = true;
  action.className = 'itemAction ec-native-playback-action';
  action.dataset.action = target.positionTicks > 0 ? 'resume' : 'play';
  action.dataset.id = target.id;
  action.dataset.serverid = target.serverId;
  action.dataset.type = target.type;
  action.dataset.mediatype = target.mediaType;
  action.dataset.isfolder = String(target.isFolder);
  action.dataset.positionticks = String(target.positionTicks);
  action.setAttribute('aria-hidden', 'true');
  action.tabIndex = -1;
  return action;
}

function dispatchNativePlayback(target: PlaybackTarget): boolean {
  const container = Array.from(document.querySelectorAll<HTMLElement>('.itemsContainer'))
    .find(candidate => candidate.isConnected);
  if (!container) return false;

  const action = createNativePlaybackAction(target);
  container.appendChild(action);
  try {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    return action.dispatchEvent(event) === false;
  } finally {
    action.remove();
  }
}

function updateButton(button: HTMLButtonElement, target: PlaybackTarget, customPlayText?: string | null): void {
  const label = target.positionTicks > 0
    ? `▶ ${t('carousel.resume')}`
    : customPlayText || `▶ ${t('carousel.play')}`;
  button.textContent = label;
  button.setAttribute('aria-label', target.positionTicks > 0 ? t('carousel.resume') : t('carousel.play'));
  button.title = target.positionTicks > 0 ? t('carousel.resume') : t('carousel.play');
}

export function createPlaybackButton(item: FeaturedItem, customPlayText?: string | null): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'raised button-submit emby-button';
  button.textContent = customPlayText || `▶ ${t('carousel.play')}`;
  button.setAttribute('aria-label', t('carousel.play'));

  const refresh = async (force = false): Promise<PlaybackTarget> => {
    const target = await resolvePlaybackTarget(item, force);
    updateButton(button, target, customPlayText);
    return target;
  };

  void refresh().catch(() => undefined);
  button.addEventListener('focus', () => void refresh(true).catch(() => undefined));
  button.addEventListener('pointerdown', () => void refresh(true).catch(() => undefined));
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const target = await refresh();
      if (!dispatchNativePlayback(target)) openItemDetails(target.id);
    } catch (error) {
      console.warn('[Jellyfin Featured] Could not start playback.', error);
      openItemDetails(item.id);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
  return button;
}
