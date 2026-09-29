import { getApiClient, requestJson } from '../core/apiClient';
import { t } from '../i18n';
import type { FeaturedItem } from '../types/featured';
import { showTransientActionError } from './actionFeedback';

interface FavoriteResponse {
  IsFavorite?: boolean;
}

function updateButton(button: HTMLButtonElement, favorite: boolean): void {
  button.setAttribute('aria-pressed', String(favorite));
  button.setAttribute('aria-label', t(favorite ? 'carousel.removeFavorite' : 'carousel.addFavorite'));
  button.title = t(favorite ? 'carousel.removeFavorite' : 'carousel.addFavorite');
  button.dataset.isfavorite = String(favorite);
  if (button.classList.contains('featured-favorite-button-meta')) {
    button.style.color = favorite ? '#ff4058' : 'var(--featured-on-media-color, #fff)';
  }
}

function styleMetadataButton(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    alignItems: 'center',
    appearance: 'none',
    background: 'transparent',
    border: '0',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'inline-flex',
    justifyContent: 'center',
    lineHeight: '1',
    minHeight: '1.8rem',
    minWidth: '1.8rem',
    padding: '.15rem',
    textShadow: '0 2px 8px rgba(0, 0, 0, .8)'
  });
}

export function createFavoriteButton(item: FeaturedItem, variant: 'action' | 'metadata' = 'action'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    variant === 'metadata'
      ? 'button-flat btnUserRating detailButton emby-button featured-favorite-button featured-favorite-button-meta'
      : 'featured-button featured-button-secondary featured-favorite-button raised emby-button';
  button.setAttribute('is', 'emby-ratingbutton');
  button.dataset.id = item.id;
  const serverId = getApiClient()?.serverId?.();
  if (serverId) button.dataset.serverid = serverId;
  button.dataset.likes = 'undefined';
  if (variant === 'metadata') styleMetadataButton(button);
  const content = document.createElement('div');
  content.className = 'detailButton-content';
  const icon = document.createElement('span');
  icon.className = 'material-icons detailButton-icon favorite';
  if (variant === 'metadata') icon.style.fontSize = '1.35rem';
  icon.setAttribute('aria-hidden', 'true');
  content.appendChild(icon);
  button.appendChild(content);
  updateButton(button, item.isFavorite);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.removeAttribute('data-error');
    button.parentElement?.querySelector('.featured-favorite-error')?.remove();
    const next = !item.isFavorite;
    try {
      const result = await requestJson<FavoriteResponse>(`UserFavoriteItems/${encodeURIComponent(item.id)}`, {
        method: next ? 'POST' : 'DELETE'
      });
      item.isFavorite = result.IsFavorite ?? next;
      updateButton(button, item.isFavorite);
      try {
        await requestJson('featured/favorites/changed', { method: 'POST', body: { itemId: item.id } });
      } catch (error) {
        console.warn('Jellyfin Featured: could not refresh favorite-dependent feeds.', error);
      }
    } catch (error) {
      showTransientActionError(button, 'featured-favorite-error', t('carousel.favoriteError'));
      console.warn('Jellyfin Featured: could not change favorite.', error);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}
