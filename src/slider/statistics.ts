import { requestJson } from '../core/apiClient';

export type FeaturedInteraction = 'open' | 'play';

/** Counts an opened or played banner title for the admin statistics; failures never block the action itself. */
export function reportInteraction(itemId: string, kind: FeaturedInteraction): void {
  void requestJson('featured/items/interaction', { method: 'POST', body: { itemId, kind } }).catch(() => undefined);
}
