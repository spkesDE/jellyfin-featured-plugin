import bootstrapStyles from './styles/bootstrap.css?inline';
import { getHeroHeightCssValue } from './slider/layout';
import type { HeroHeightMode } from './types/config';

interface BootstrapSettings {
  hero: boolean;
  hideOnTv: boolean;
  heightMode: HeroHeightMode;
  desktopHeight: number;
  tabletHeight: number;
  mobileHeight: number;
  radius: number;
  mediaPadding: number;
  heroOverlap: number;
  heading: string;
}

const CONTAINER_SELECTOR =
  '#indexPage:not(.hide) #homeTab.is-active .homeSectionsContainer, #homeTab.is-active .homeSectionsContainer';
const STYLE_ID = 'jellyfin-featured-bootstrap-styles';

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = bootstrapStyles;
  (document.head || document.documentElement).appendChild(style);
}

function createPlaceholder(settings: BootstrapSettings): HTMLElement {
  const placeholder = document.createElement('section');
  placeholder.className = `ec-bootstrap-placeholder ec-bootstrap-height-${settings.heightMode}${settings.hero ? ' ec-bootstrap-hero' : ''}`;
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.style.setProperty('--ec-height', getHeroHeightCssValue(settings.heightMode, settings.desktopHeight));
  placeholder.style.setProperty('--ec-tablet-height', `${settings.tabletHeight}px`);
  placeholder.style.setProperty('--ec-mobile-height', `${settings.mobileHeight}px`);
  placeholder.style.setProperty('--ec-hero-overlap', `${settings.heroOverlap}px`);
  if (!settings.hero) placeholder.style.setProperty('--ec-radius', `${settings.radius}px`);
  placeholder.style.setProperty('--ec-media-padding', `${settings.mediaPadding}px`);

  if (settings.heading && !settings.hero) {
    const heading = document.createElement('h2');
    heading.className = 'sectionTitle sectionTitle-cards ec-bootstrap-heading';
    heading.textContent = settings.heading;
    placeholder.appendChild(heading);
  }

  const viewport = document.createElement('div');
  viewport.className = 'ec-bootstrap-viewport';
  placeholder.appendChild(viewport);
  return placeholder;
}

function startBootstrap(settings: BootstrapSettings): void {
  if (window.JellyfinFeaturedBootstrap) return;
  installStyles();

  let scheduled = false;
  const scan = (): void => {
    scheduled = false;
    document.querySelectorAll('.ec-bootstrap-placeholder').forEach((element) => {
      if (!element.parentElement?.matches(CONTAINER_SELECTOR)) element.remove();
    });
    document.querySelectorAll(CONTAINER_SELECTOR).forEach((container) => {
      const hiddenOnTv = settings.hideOnTv && document.documentElement.classList.contains('layout-tv');
      const alreadyMounted = container.querySelector(':scope > .ec-root, :scope > .ec-bootstrap-placeholder');
      if (hiddenOnTv || alreadyMounted) return;

      container.prepend(createPlaceholder(settings));
      container.closest('#homeTab')?.classList.toggle('ec-bootstrap-hero-page', settings.hero);
    });
  };
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });
  window.JellyfinFeaturedBootstrap = { stop: () => observer.disconnect() };
  schedule();
}

const settings = window.JellyfinFeaturedBootstrapSettings;
if (settings) startBootstrap(settings);
