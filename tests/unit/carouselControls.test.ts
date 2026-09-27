import { describe, expect, it, vi } from 'vitest';
import {
  createAutoplayControl,
  createCarouselArrow,
  createPaginationDots,
  updateAutoplayControl
} from '../../src/slider/carouselControls';

describe('carousel controls', () => {
  it('builds accessible navigation controls that report domain actions', () => {
    const move = vi.fn();
    const previous = createCarouselArrow('prev', move);
    const next = createCarouselArrow('next', move);
    previous.click();
    next.click();

    expect(move.mock.calls).toEqual([[-1], [1]]);
    expect(previous.getAttribute('aria-label')).toBeTruthy();
    expect(next.querySelector('.chevron_right')).not.toBeNull();
  });

  it('owns autoplay and pagination markup without carousel state', () => {
    const toggle = vi.fn();
    const autoplay = createAutoplayControl(toggle);
    updateAutoplayControl(autoplay.button, true);
    autoplay.button.click();
    const activate = vi.fn();
    const pagination = createPaginationDots(3, activate);
    pagination.buttons[2]?.click();

    expect(toggle).toHaveBeenCalledOnce();
    expect(autoplay.button.querySelector('.pause')).not.toBeNull();
    expect(autoplay.countdownProgress.getAttribute('pathLength')).toBe('100');
    expect(activate).toHaveBeenCalledWith(2);
  });
});
