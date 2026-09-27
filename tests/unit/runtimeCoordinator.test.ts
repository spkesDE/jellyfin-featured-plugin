import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeCoordinator } from '../../src/core/runtimeCoordinator';

describe('RuntimeCoordinator', () => {
  afterEach(() => vi.useRealTimers());

  it('coalesces scans while preserving the strongest cleanup request', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 7;
    });
    const scan = vi.fn();
    const coordinator = createCoordinator(scan);

    coordinator.scheduleScan(false);
    coordinator.scheduleScan(true);
    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
    frame?.(0);

    expect(scan).toHaveBeenCalledWith(true);
  });

  it('owns observer, route, scan, and preset timer teardown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(13);
    const presetBoundaryReached = vi.fn();
    const coordinator = createCoordinator(vi.fn(), presetBoundaryReached);

    coordinator.start(document.body);
    coordinator.scheduleScan();
    coordinator.schedulePresetRefresh('2026-09-26T11:59:00Z');
    expect(coordinator.isStarted).toBe(true);
    vi.advanceTimersByTime(250);
    expect(presetBoundaryReached).toHaveBeenCalledOnce();

    coordinator.stop();
    expect(coordinator.isStarted).toBe(false);
    expect(cancelFrame).toHaveBeenCalledWith(13);
  });
});

function createCoordinator(scan: (removeInactive: boolean) => void, presetBoundaryReached = vi.fn()) {
  return new RuntimeCoordinator<HTMLElement>({
    scan,
    routeChanged: vi.fn(),
    mutationsObserved: vi.fn(),
    presetBoundaryReached
  });
}
