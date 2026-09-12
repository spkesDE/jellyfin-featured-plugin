import { getAccessToken, getApiClient } from '../core/apiClient';

export function trailerUrl(trailerId: string): string {
  const api = getApiClient();
  const token = getAccessToken();
  return api?.getUrl?.(`Videos/${encodeURIComponent(trailerId)}/stream`, {
    Static: true,
    MediaSourceId: trailerId,
    DeviceId: api.deviceId?.(),
    api_key: token
  }) ?? '';
}
