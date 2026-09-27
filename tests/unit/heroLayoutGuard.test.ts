import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroLayoutGuard } from '../../src/slider/heroLayoutGuard';

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
});
