import type { FeaturedMediaPriorityEntry, MediaPriorityType, SourceType } from '../../types/config';
import { t, type TranslationKey } from '../../i18n';

export type SourceTypeGroup = 'selection' | 'time' | 'personal' | 'other';

export interface SourceTypeInfo {
  label: TranslationKey;
  help: TranslationKey;
  short: TranslationKey;
  icon: string;
  group: SourceTypeGroup;
}

/** Display metadata for every source type, in the order the add menu lists them. */
export const SOURCE_TYPES: Record<SourceType, SourceTypeInfo> = {
  LIBRARIES: {
    label: 'source.type.libraries',
    help: 'source.help.libraries',
    short: 'source.short.libraries',
    icon: 'video_library',
    group: 'selection'
  },
  COLLECTIONS: {
    label: 'source.type.collections',
    help: 'source.help.collections',
    short: 'source.short.collections',
    icon: 'collections_bookmark',
    group: 'selection'
  },
  TAGS: {
    label: 'source.type.tags',
    help: 'source.help.tags',
    short: 'source.short.tags',
    icon: 'label',
    group: 'selection'
  },
  PLAYLISTS: {
    label: 'source.type.playlists',
    help: 'source.help.playlists',
    short: 'source.short.playlists',
    icon: 'playlist_play',
    group: 'selection'
  },
  FAVOURITES: {
    label: 'source.type.favourites',
    help: 'source.help.favourites',
    short: 'source.short.favourites',
    icon: 'favorite',
    group: 'selection'
  },
  RECENTLY_ADDED: {
    label: 'source.type.recently_added',
    help: 'source.help.recently_added',
    short: 'source.short.recently_added',
    icon: 'new_releases',
    group: 'time'
  },
  LATEST_RELEASES: {
    label: 'source.type.latest_releases',
    help: 'source.help.latest_releases',
    short: 'source.short.latest_releases',
    icon: 'event',
    group: 'time'
  },
  UNPLAYED: {
    label: 'source.type.unplayed',
    help: 'source.help.unplayed',
    short: 'source.short.unplayed',
    icon: 'visibility_off',
    group: 'personal'
  },
  CONTINUE_WATCHING: {
    label: 'source.type.continue_watching',
    help: 'source.help.continue_watching',
    short: 'source.short.continue_watching',
    icon: 'play_circle',
    group: 'personal'
  },
  NEXT_UP: {
    label: 'source.type.next_up',
    help: 'source.help.next_up',
    short: 'source.short.next_up',
    icon: 'skip_next',
    group: 'personal'
  },
  RECOMMENDATIONS: {
    label: 'source.type.recommendations',
    help: 'source.help.recommendations',
    short: 'source.short.recommendations',
    icon: 'recommend',
    group: 'personal'
  },
  MANUAL_LISTS: {
    label: 'source.type.manual_lists',
    help: 'source.help.manual_lists',
    short: 'source.short.manual_lists',
    icon: 'format_list_numbered',
    group: 'other'
  },
  RANDOM: {
    label: 'source.type.random',
    help: 'source.help.random',
    short: 'source.short.random',
    icon: 'shuffle',
    group: 'other'
  }
};

export const SOURCE_TYPE_GROUP_LABELS: Record<SourceTypeGroup, TranslationKey> = {
  selection: 'source.group.selection',
  time: 'source.group.time',
  personal: 'source.group.personal',
  other: 'source.group.other'
};

const MEDIA_PRIORITY_LABELS: Record<MediaPriorityType, TranslationKey> = {
  local_trailer: 'source.mediaPriority.local_trailer',
  remote_trailer: 'source.mediaPriority.remote_trailer',
  media_excerpt: 'source.mediaPriority.media_excerpt',
  trickplay: 'source.mediaPriority.trickplay'
};

export const mediaPriorityLabel = (entry: FeaturedMediaPriorityEntry): string => t(MEDIA_PRIORITY_LABELS[entry.Type]);
