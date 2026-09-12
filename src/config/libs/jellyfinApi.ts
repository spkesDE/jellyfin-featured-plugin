import { getApiClient, requestJson } from '../../core/apiClient';
import { t } from '../../i18n';
import type { JellyfinItem, JellyfinItemFilters, JellyfinUser, ParentalRating } from '../../types/jellyfin';
import type { ConfigCollection, ConfigLibrary, ConfigPlaylist, ConfigRating, ConfigUser } from './types';

function normalizeItems(payload: unknown): JellyfinItem[] {
  return payload && typeof payload === 'object' && Array.isArray((payload as { Items?: unknown[] }).Items)
    ? (payload as { Items: JellyfinItem[] }).Items
    : [];
}

export async function loadUsers(): Promise<ConfigUser[]> {
  try {
    const users: JellyfinUser[] = await (getApiClient()?.getUsers?.() ?? requestJson<JellyfinUser[]>('Users'));
    return users.filter((user) => !user.Policy?.IsDisabled).map(({ Id, Name }) => ({ Id, Name }));
  } catch {
    return [];
  }
}

export async function loadLibrariesAndCollections(): Promise<{
  libraries: ConfigLibrary[];
  collections: ConfigCollection[];
  playlists: ConfigPlaylist[];
  genres: string[];
  tags: string[];
}> {
  try {
    const api = getApiClient();
    const userId = api?.getCurrentUserId?.();
    const userQuery = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    const roots = normalizeItems(await (api?.getItems?.() ?? requestJson('Items')));
    const libraries = roots
      .filter((item) => ['movies', 'tvshows', 'music', 'musicvideos', 'books', 'homevideos', 'photos', 'mixed']
        .includes(String(item.CollectionType).toLowerCase()))
      .map(({ Id, Name, CollectionType }) => ({ Id, Name, CollectionType }));
    const collectionRoots = roots.filter((item) => String(item.CollectionType).toLowerCase() === 'boxsets');
    const [childGroups, playlistPayload, filterPayload] = await Promise.all([
      Promise.all(collectionRoots.map((root) => requestJson(`Items?parentId=${encodeURIComponent(root.Id)}`).catch(() => ({ Items: [] })))),
      requestJson(`Items?includeItemTypes=Playlist&recursive=true${userQuery}`).catch(() => ({ Items: [] })),
      requestJson<JellyfinItemFilters>(`Items/Filters?includeItemTypes=Movie,Series,MusicVideo,Video,AudioBook,Book,MusicAlbum,Photo,PhotoAlbum${userQuery}`).catch((): JellyfinItemFilters => ({}))
    ]);
    const collections = mergeNamedItems(childGroups.flatMap(normalizeItems).map(({ Id, Name }) => ({ Id, Name })));
    const playlists = mergeNamedItems(normalizeItems(playlistPayload).map(({ Id, Name }) => ({ Id, Name })));
    const genres = mergeStrings(filterPayload.Genres);
    const tags = mergeStrings(filterPayload.Tags);
    return { libraries, collections, playlists, genres, tags };
  } catch {
    return { libraries: [], collections: [], playlists: [], genres: [], tags: [] };
  }
}

function mergeNamedItems<T extends { Id: string; Name: string }>(...groups: T[][]): T[] {
  return [...new Map(groups.flat().map((item) => [item.Id, item])).values()]
    .sort((a, b) => a.Name.localeCompare(b.Name));
}

function mergeStrings(...groups: Array<string[] | undefined>): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export async function loadRatings(): Promise<ConfigRating[]> {
  const result: ConfigRating[] = [{ value: '-2,0', label: t('filter.currentUserProfile') }];
  try {
    const ratings: ParentalRating[] = await (getApiClient()?.getParentalRatings?.() ?? requestJson<ParentalRating[]>('Localization/ParentalRatings'));
    for (const rating of ratings) {
      if (!rating.RatingScore) continue;
      const value = `${rating.RatingScore.score},${rating.RatingScore.subScore}`;
      const existing = result.find((entry) => entry.value === value);
      if (existing) existing.label += ` / ${rating.Name}`;
      else result.push({ value, label: rating.Name });
    }
  } catch {
    // Keeping the profile default is safe when the server cannot provide the list.
  }
  return result;
}
