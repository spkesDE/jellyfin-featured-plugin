import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutInsetGuard, calculateHeaderOffset } from '../../src/slider/layoutInsets';

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) };
}

function setLayoutBox(element: HTMLElement, box: { offsetTop?: number; width?: number; height: number }): void {
  Object.defineProperty(element, 'offsetTop', { configurable: true, value: box.offsetTop ?? 0 });
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: box.width ?? 0 });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: box.height });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: box.height });
}

function runNextFrame(): void {
  const callback = vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0];
  callback?.(0);
}

describe('calculateHeaderOffset', () => {
  it('reports only the part of the viewport covered by the header', () => {
    expect(calculateHeaderOffset(104, -8)).toBe(112);
    expect(calculateHeaderOffset(104, 103.2)).toBe(1);
    expect(calculateHeaderOffset(64, 120)).toBe(0);
  });
});

describe('LayoutInsetGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('publishes header and control slot insets for the text block', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const header = document.createElement('div');
    header.className = 'skinHeader';
    header.style.position = 'fixed';
    setLayoutBox(header, { height: 104 });
    const root = document.createElement('section');
    root.innerHTML =
      '<div class="featured-viewport"><div class="featured-navigation">' +
      '<div class="featured-control-slot featured-control-slot-top-right"></div></div></div>';
    const viewport = root.querySelector<HTMLElement>('.featured-viewport')!;
    const slot = root.querySelector<HTMLElement>('.featured-control-slot')!;
    setLayoutBox(viewport, { height: 500 });
    setLayoutBox(slot, { width: 120.4, height: 34 });
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect(-8, 500));
    document.body.append(header, root);

    const guard = new LayoutInsetGuard(root);
    guard.start();
    runNextFrame();

    expect(root.style.getPropertyValue('--featured-header-offset')).toBe('112px');
    expect(root.style.getPropertyValue('--featured-viewport-height')).toBe('500px');
    expect(root.style.getPropertyValue('--featured-slot-top-right-width')).toBe('121px');
    expect(root.style.getPropertyValue('--featured-slot-top-right-height')).toBe('34px');
    expect(root.style.getPropertyValue('--featured-slot-center-width')).toBe('');

    // Scrolling the page must not move the copy: the offset is measured in document space.
    document.documentElement.scrollTop = 300;
    vi.mocked(viewport.getBoundingClientRect).mockReturnValue(rect(-308, 500));
    guard.activeContentChanged();
    runNextFrame();
    expect(root.style.getPropertyValue('--featured-header-offset')).toBe('112px');
    document.documentElement.scrollTop = 0;
    guard.destroy();
  });

  it('clears the header offset when the banner starts below the header', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const header = document.createElement('div');
    header.className = 'skinHeader';
    setLayoutBox(header, { height: 64 });
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(rect(0, 64));
    const root = document.createElement('section');
    root.innerHTML = '<div class="featured-viewport"></div>';
    const viewport = root.querySelector<HTMLElement>('.featured-viewport')!;
    setLayoutBox(viewport, { height: 360 });
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect(140, 360));
    root.style.setProperty('--featured-header-offset', '40px');
    document.body.append(header, root);

    const guard = new LayoutInsetGuard(root);
    guard.start();
    runNextFrame();

    expect(root.style.getPropertyValue('--featured-header-offset')).toBe('');
    guard.destroy();
  });

  it('publishes the hero control column size so right-aligned copy can start below it', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const root = document.createElement('section');
    root.className = 'featured-root featured-hero';
    root.innerHTML = '<div class="featured-viewport"><div class="featured-navigation"></div></div>';
    setLayoutBox(root.querySelector<HTMLElement>('.featured-viewport')!, { height: 500 });
    setLayoutBox(root.querySelector<HTMLElement>('.featured-navigation')!, { width: 150, height: 72.5 });
    document.body.appendChild(root);

    const guard = new LayoutInsetGuard(root);
    guard.start();
    runNextFrame();

    expect(root.style.getPropertyValue('--featured-navigation-width')).toBe('150px');
    expect(root.style.getPropertyValue('--featured-navigation-height')).toBe('73px');
    guard.destroy();
  });

  it('registers and tears down its lifecycle listeners symmetrically', () => {
    const root = document.createElement('section');
    document.body.appendChild(root);
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const guard = new LayoutInsetGuard(root);

    guard.start();
    guard.destroy();

    expect(addWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
