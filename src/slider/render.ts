import type { FeaturedItem, FeaturedResponse } from '../types/featured';
import { t } from '../i18n';
import { heroImageUrl, logoUrl } from './images';
import { openItemDetails } from './navigation';

export function loadSlideArtwork(slide: HTMLElement): void {
  const backdrop = slide.querySelector<HTMLElement>('.ec-backdrop');
  const backdropUrl = backdrop?.dataset.ecImageUrl;
  if (backdrop && backdropUrl) {
    backdrop.style.backgroundImage = `url("${backdropUrl.replace(/"/g, '%22')}")`;
    delete backdrop.dataset.ecImageUrl;
  }

  const logo = slide.querySelector<HTMLImageElement>('.ec-logo');
  const logoUrl = logo?.dataset.ecImageUrl;
  if (logo && logoUrl) {
    logo.src = logoUrl;
    delete logo.dataset.ecImageUrl;
  }
}

function appendText(parent: HTMLElement, className: string, value: string | null | undefined): void {
  if (!value) return;
  const node = document.createElement('p');
  node.className = className;
  node.textContent = value;
  parent.appendChild(node);
}

function createMetadata(item: FeaturedItem, response: FeaturedResponse): HTMLElement | null {
  const metadata = document.createElement('div');
  metadata.className = 'ec-meta';

  if (response.showRating && item.community_rating !== undefined) {
    const rating = document.createElement('span');
    rating.className = 'ec-community';
    rating.textContent = item.community_rating.toFixed(1);
    metadata.appendChild(rating);
  }
  if (response.showRating && item.critic_rating !== undefined) {
    const critic = document.createElement('span');
    critic.textContent = t('carousel.critics', { score: Math.round(item.critic_rating) });
    metadata.appendChild(critic);
  }
  if (response.showRating && item.official_rating) {
    const official = document.createElement('span');
    official.textContent = item.official_rating;
    metadata.appendChild(official);
  }
  if (response.showYear && item.productionYear !== undefined) {
    const year = document.createElement('span');
    year.textContent = String(item.productionYear);
    metadata.appendChild(year);
  }
  if (response.showRuntime && item.runtimeMinutes !== undefined) {
    const runtime = document.createElement('span');
    runtime.textContent = `${item.runtimeMinutes} min`;
    metadata.appendChild(runtime);
  }
  return metadata.childElementCount ? metadata : null;
}

export function createSlide(item: FeaturedItem, response: FeaturedResponse): HTMLElement {
  const slide = document.createElement('article');
  slide.className = 'ec-slide';
  slide.setAttribute('role', 'link');
  slide.setAttribute('aria-label', item.name);
  slide.tabIndex = -1;

  const backdrop = document.createElement('div');
  backdrop.className = 'ec-backdrop';
  backdrop.dataset.ecImageUrl = heroImageUrl(item.id, item.imageType, response.reduceImageSizes);
  backdrop.style.backgroundPosition = response.heroBackdropPosition;
  slide.appendChild(backdrop);

  const content = document.createElement('div');
  content.className = 'ec-content';
  if (response.titleDisplayMode === 'logo' && item.hasLogo) {
    const logo = document.createElement('img');
    logo.className = 'ec-logo';
    logo.dataset.ecImageUrl = logoUrl(item.id, response.reduceImageSizes);
    logo.alt = item.name;
    logo.loading = 'lazy';
    logo.decoding = 'async';
    content.appendChild(logo);
  } else {
    const title = document.createElement('h2');
    title.className = 'ec-title';
    title.textContent = item.name;
    content.appendChild(title);
  }

  const metadata = createMetadata(item, response);
  if (metadata) content.appendChild(metadata);
  appendText(content, 'ec-tagline', item.tagline);
  appendText(content, 'ec-overview', item.overview);

  if (response.showPlayButton || response.showSecondaryButton) {
    const actions = document.createElement('div');
    actions.className = 'ec-actions';
    if (response.showPlayButton) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'ec-button';
      play.textContent = response.playButtonText || `▶ ${t('carousel.play')}`;
      play.addEventListener('click', () => window.Emby?.Page?.showItem?.(item.id));
      actions.appendChild(play);
    }
    if (response.showSecondaryButton) {
      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'ec-button ec-button-secondary';
      details.textContent = response.secondaryButtonText || t('carousel.moreInfo');
      details.addEventListener('click', () => openItemDetails(item.id));
      actions.appendChild(details);
    }
    content.appendChild(actions);
  }

  slide.addEventListener('click', (event) => {
    if ((event.target as Element).closest('button')) return;
    openItemDetails(item.id);
  });
  slide.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openItemDetails(item.id);
  });
  slide.appendChild(content);
  return slide;
}
