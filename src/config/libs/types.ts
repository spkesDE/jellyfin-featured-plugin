export type ConfigTab = 'sources' | 'manual' | 'users' | 'filters' | 'display' | 'trailers' | 'advanced';
export type SaveState = 'clean' | 'dirty' | 'saved';

export interface ConfigUser { Id: string; Name: string }
export interface ConfigLibrary { Id: string; Name: string; CollectionType?: string }
export interface ConfigCollection { Id: string; Name: string }
export interface ConfigPlaylist { Id: string; Name: string }
export interface ConfigRating { value: string; label: string }
