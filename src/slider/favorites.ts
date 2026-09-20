import { requestJson } from '../core/apiClient';
import { USER_PREFERENCES_CHANGED_EVENT } from '../constants';
import { t } from '../i18n';
import type { FeaturedItem } from '../types/featured';

interface FavoriteResponse { IsFavorite?: boolean }

function updateButton(button: HTMLButtonElement, favorite: boolean): void {
  button.setAttribute('aria-pressed', String(favorite));
  button.setAttribute('aria-label', t(favorite ? 'carousel.removeFavorite' : 'carousel.addFavorite'));
  button.title = t(favorite ? 'carousel.removeFavorite' : 'carousel.addFavorite');
  const icon = button.querySelector<HTMLElement>('.material-icons');
  if (icon) icon.textContent = favorite ? 'favorite' : 'favorite_border';
}

export function createFavoriteButton(item: FeaturedItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ec-button ec-button-secondary ec-favorite-button raised emby-button';
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  updateButton(button, item.isFavorite);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.removeAttribute('data-error');
    button.parentElement?.querySelector('.ec-favorite-error')?.remove();
    const next = !item.isFavorite;
    try {
      const result = await requestJson<FavoriteResponse>(`UserFavoriteItems/${encodeURIComponent(item.id)}`,
        { method: next ? 'POST' : 'DELETE' });
      item.isFavorite = result.IsFavorite ?? next;
      updateButton(button, item.isFavorite);
      try {
        await requestJson('featured/favorites/changed', { method: 'POST', body: { itemId: item.id } });
        document.dispatchEvent(new Event(USER_PREFERENCES_CHANGED_EVENT));
      } catch (error) {
        console.warn('Jellyfin Featured: could not refresh favorite-dependent feeds.', error);
      }
    } catch (error) {
      button.dataset.error = t('carousel.favoriteError');
      button.title = t('carousel.favoriteError');
      const status = document.createElement('span');
      status.className = 'ec-favorite-error';
      status.setAttribute('role', 'alert');
      status.textContent = t('carousel.favoriteError');
      button.after(status);
      window.setTimeout(() => status.remove(), 4000);
      console.warn('Jellyfin Featured: could not change favorite.', error);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}
