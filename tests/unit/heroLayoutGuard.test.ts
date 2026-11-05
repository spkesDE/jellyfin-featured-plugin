import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroLayoutGuard } from '../../src/slider/heroLayoutGuard';
import { findFollowingSection } from '../../src/slider/layout';

describe('HeroLayoutGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registers and tears down its lifecycle listeners symmetrically', () => {
    const root = document.createElement('section');
    const content = document.createElement('div');
    root.appendChild(content);
    document.body.appendChild(root);
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addRoot = vi.spyOn(root, 'addEventListener');
    const removeRoot = vi.spyOn(root, 'removeEventListener');
    const guard = new HeroLayoutGuard(root, () => content);

    guard.start();
    guard.destroy();

    expect(addWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addRoot).toHaveBeenCalledWith('load', expect.any(Function), true);
    expect(removeRoot).toHaveBeenCalledWith('load', expect.any(Function), true);
  });

  it('ignores a hidden sibling such as the Home Screen Sections loading indicator', async () => {
    const parent = document.createElement('div');
    const root = document.createElement('section');
    const content = document.createElement('div');
    const contentChild = document.createElement('div');
    content.appendChild(contentChild);
    root.appendChild(content);
    const hidden = stubBox(document.createElement('div'), null);
    const section = stubBox(document.createElement('div'), 500);
    stubBox(contentChild, 0, 400);
    parent.append(root, hidden, section);
    document.body.appendChild(parent);
    const guard = new HeroLayoutGuard(root, () => content);

    guard.start();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    guard.destroy();
    parent.remove();

    expect(root.style.getPropertyValue('--featured-content-clearance')).toBe('');
  });
});

describe('findFollowingSection', () => {
  it('picks the visually first section, not the first sibling in DOM order', () => {
    const parent = document.createElement('div');
    const root = document.createElement('section');
    const hidden = stubBox(document.createElement('div'), null);
    const reorderedLast = stubBox(document.createElement('div'), 2000);
    const first = stubBox(document.createElement('div'), 500);
    parent.append(root, hidden, reorderedLast, first);
    document.body.appendChild(parent);

    expect(findFollowingSection(root)).toBe(first);
    parent.remove();
  });

  it('ignores out-of-flow siblings and returns null without a visible section', () => {
    const parent = document.createElement('div');
    const root = document.createElement('section');
    const fixed = stubBox(document.createElement('div'), 0);
    fixed.style.position = 'fixed';
    parent.append(root, fixed, stubBox(document.createElement('div'), null));
    document.body.appendChild(parent);

    expect(findFollowingSection(root)).toBeNull();
    parent.remove();
  });
});

/** happy-dom has no layout, so boxes are stubbed. A null top models display: none. */
function stubBox<T extends HTMLElement>(element: T, top: number | null, bottom = top ?? 0): T {
  const rect = { top: top ?? 0, bottom } as DOMRect;
  vi.spyOn(element, 'getClientRects').mockReturnValue((top === null ? [] : [rect]) as unknown as DOMRectList);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
  return element;
}
