import { getApiClient } from '../core/apiClient';

function itemImageUrl(itemId: string, type: 'Backdrop' | 'Primary' | 'Logo', maxWidth: number): string {
  const api = getApiClient();
  return api?.getUrl?.(`Items/${encodeURIComponent(itemId)}/Images/${type}/0`, {
    maxWidth,
    quality: 90
  }) ?? `../Items/${encodeURIComponent(itemId)}/Images/${type}/0?maxWidth=${maxWidth}&quality=90`;
}

export function backdropUrl(itemId: string, reduce: boolean): string {
  return itemImageUrl(itemId, 'Backdrop', reduce ? 1280 : 2560);
}

export function heroImageUrl(itemId: string, imageType: 'Backdrop' | 'Primary', reduce: boolean): string {
  return itemImageUrl(itemId, imageType, reduce ? 1280 : 2560);
}

export function logoUrl(itemId: string, reduce: boolean): string {
  return itemImageUrl(itemId, 'Logo', reduce ? 600 : 1200);
}
