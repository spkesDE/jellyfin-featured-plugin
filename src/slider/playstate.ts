import { getApiClient, requestJson } from '../core/apiClient';
import { t } from '../i18n';
import type { FeaturedItem } from '../types/featured';

interface PlaystateResponse { Played?: boolean }

function updateButton(button: HTMLButtonElement, played: boolean): void {
  button.setAttribute('aria-pressed', String(played));
  button.setAttribute('aria-label', t(played ? 'carousel.markUnplayed' : 'carousel.markPlayed'));
  button.title = t(played ? 'carousel.markUnplayed' : 'carousel.markPlayed');
  button.dataset.played = String(played);
  const icon = button.querySelector<HTMLElement>('.material-icons');
  if (icon) {
    icon.classList.toggle('playstatebutton-icon-played', played);
    icon.classList.toggle('playstatebutton-icon-unplayed', !played);
  }
}

export function createPlaystateButton(item: FeaturedItem, variant: 'action' | 'metadata' = 'metadata'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant === 'metadata'
    ? 'button-flat btnPlaystate detailButton emby-button ec-playstate-button ec-playstate-button-meta'
    : 'ec-button ec-button-secondary ec-playstate-button raised emby-button';
  button.setAttribute('is', 'emby-playstatebutton');
  button.dataset.id = item.id;
  button.dataset.type = item.mediaType;
  const serverId = getApiClient()?.serverId?.();
  if (serverId) button.dataset.serverid = serverId;

  const content = document.createElement('div');
  content.className = 'detailButton-content';
  const icon = document.createElement('span');
  icon.className = 'material-icons detailButton-icon check';
  if (variant === 'metadata') icon.style.fontSize = '1.35rem';
  icon.setAttribute('aria-hidden', 'true');
  content.appendChild(icon);
  button.appendChild(content);
  updateButton(button, item.isPlayed);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.removeAttribute('data-error');
    button.parentElement?.querySelector('.ec-playstate-error')?.remove();
    const next = !item.isPlayed;
    try {
      const result = await requestJson<PlaystateResponse>(`UserPlayedItems/${encodeURIComponent(item.id)}`,
        { method: next ? 'POST' : 'DELETE' });
      item.isPlayed = result.Played ?? next;
      updateButton(button, item.isPlayed);
      try {
        await requestJson('featured/playstate/changed', { method: 'POST', body: { itemId: item.id } });
      } catch (error) {
        console.warn('Jellyfin Featured: could not refresh playstate-dependent feeds.', error);
      }
    } catch (error) {
      button.dataset.error = t('carousel.playstateError');
      button.title = t('carousel.playstateError');
      const status = document.createElement('span');
      status.className = 'ec-playstate-error';
      status.setAttribute('role', 'alert');
      status.textContent = t('carousel.playstateError');
      button.after(status);
      window.setTimeout(() => status.remove(), 4000);
      console.warn('Jellyfin Featured: could not change play state.', error);
    } finally {
      button.disabled = false;
    }
  });

  return button;
}
