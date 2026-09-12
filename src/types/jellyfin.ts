export interface JellyfinAjaxRequest {
  type: 'GET' | 'POST' | 'PUT';
  url: string;
  dataType?: 'json';
  contentType?: 'application/json';
  data?: string;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  Policy?: { IsDisabled?: boolean };
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  CollectionType?: string;
}

export interface JellyfinItemFilters {
  Genres?: string[];
  Tags?: string[];
}

export interface FeaturedConfigOptions {
  collections?: Array<{ id: string; name: string }>;
  playlists?: Array<{ id: string; name: string }>;
  genres?: string[];
  tags?: string[];
}

export interface ParentalRating {
  Name: string;
  RatingScore?: { score: number; subScore: number } | null;
}

export interface JellyfinApiClient {
  accessToken?: (() => string | undefined) | string;
  deviceId?: () => string | undefined;
  getCurrentUserId?: () => string | null | undefined;
  getUrl?: (path: string, query?: Record<string, string | number | boolean | null | undefined>) => string | null;
  ajax?: (request: JellyfinAjaxRequest) => Promise<unknown> | unknown;
  fetch?: (request: { url: string; type: 'GET' | 'POST' | 'PUT' }) => Promise<Response>;
  getPluginConfiguration?: (pluginId: string) => Promise<unknown>;
  updatePluginConfiguration?: (pluginId: string, config: unknown) => Promise<unknown>;
  getUsers?: () => Promise<JellyfinUser[]>;
  getItems?: () => Promise<{ Items?: JellyfinItem[] }>;
  getParentalRatings?: () => Promise<ParentalRating[]>;
}
