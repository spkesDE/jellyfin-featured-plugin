import { t } from '../i18n';

export function createCarouselStatus(): HTMLDivElement {
  const status = document.createElement('div');
  status.className = 'ec-status';
  status.setAttribute('aria-live', 'polite');
  return status;
}

export function createCarouselArrow(direction: 'prev' | 'next', activate: (offset: number) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `ec-control ec-arrow ec-arrow-${direction} emby-scrollbuttons-button paper-icon-button-light`;
  const icon = document.createElement('span');
  icon.className = `material-icons ${direction === 'prev' ? 'chevron_left' : 'chevron_right'}`;
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  button.setAttribute('aria-label', direction === 'prev' ? t('carousel.previous') : t('carousel.next'));
  button.addEventListener('click', () => activate(direction === 'prev' ? -1 : 1));
  return button;
}

export function createAutoplayControl(toggle: () => void): {
  button: HTMLButtonElement;
  countdownProgress: SVGCircleElement;
} {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ec-control ec-autoplay emby-scrollbuttons-button paper-icon-button-light';
  const countdownRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  countdownRing.classList.add('ec-countdown-ring');
  countdownRing.setAttribute('viewBox', '0 0 40 40');
  countdownRing.setAttribute('aria-hidden', 'true');
  const countdownTrack = createCountdownCircle('ec-countdown-track');
  const countdownProgress = createCountdownCircle('ec-countdown-progress');
  countdownProgress.setAttribute('pathLength', '100');
  countdownRing.append(countdownTrack, countdownProgress);
  button.appendChild(countdownRing);
  button.addEventListener('click', toggle);
  return { button, countdownProgress };
}

export function updateAutoplayControl(button: HTMLButtonElement, playing: boolean): void {
  let icon = button.querySelector<HTMLElement>('.material-icons');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
  }
  icon.className = `material-icons ${playing ? 'pause' : 'play_arrow'}`;
  button.setAttribute('aria-label', playing ? t('carousel.pauseAutoplay') : t('carousel.startAutoplay'));
}

export function createPaginationDots(
  count: number,
  activate: (index: number) => void
): {
  root: HTMLDivElement;
  buttons: HTMLButtonElement[];
} {
  const root = document.createElement('div');
  root.className = 'ec-dots';
  const buttons = Array.from({ length: count }, (_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ec-dot';
    button.setAttribute('aria-label', `${index + 1} / ${count}`);
    button.addEventListener('click', () => activate(index));
    root.appendChild(button);
    return button;
  });
  return { root, buttons };
}

function createCountdownCircle(className: string): SVGCircleElement {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.classList.add(className);
  circle.setAttribute('cx', '20');
  circle.setAttribute('cy', '20');
  circle.setAttribute('r', '17');
  return circle;
}
