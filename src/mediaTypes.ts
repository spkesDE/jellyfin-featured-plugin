import { t, type TranslationKey } from './i18n';

export const FEATURED_MEDIA_TYPES = [
  'Movie',
  'Series',
  'MusicVideo',
  'Video',
  'AudioBook',
  'Book',
  'MusicAlbum',
  'Photo',
  'PhotoAlbum'
] as const;

export type FeaturedMediaType = typeof FEATURED_MEDIA_TYPES[number];

const MEDIA_TYPE_TRANSLATIONS: Record<FeaturedMediaType, TranslationKey> = {
  Movie: 'filter.value.movies',
  Series: 'filter.value.series',
  MusicVideo: 'filter.value.musicVideos',
  Video: 'filter.value.videos',
  AudioBook: 'filter.value.audioBooks',
  Book: 'filter.value.books',
  MusicAlbum: 'filter.value.musicAlbums',
  Photo: 'filter.value.photos',
  PhotoAlbum: 'filter.value.photoAlbums'
};

export function mediaTypeLabel(value: string): string {
  return FEATURED_MEDIA_TYPES.includes(value as FeaturedMediaType)
    ? t(MEDIA_TYPE_TRANSLATIONS[value as FeaturedMediaType])
    : value;
}

export function mediaTypeOptions(): Array<{ value: FeaturedMediaType; label: string }> {
  return FEATURED_MEDIA_TYPES.map((value) => ({ value, label: t(MEDIA_TYPE_TRANSLATIONS[value]) }));
}
