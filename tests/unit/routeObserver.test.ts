import { describe, expect, it, vi } from 'vitest';
import { RouteObserver } from '../../src/core/routeObserver';

describe('RouteObserver', () => {
  it('notifies for history navigation and restores the original methods', () => {
    vi.useFakeTimers();
    const originalPushState = window.history.pushState;
    const onRouteChanged = vi.fn();
    const observer = new RouteObserver(onRouteChanged);

    observer.start();
    window.history.pushState({}, '', '#route');
    vi.runAllTimers();
    expect(onRouteChanged).toHaveBeenCalledTimes(1);

    observer.stop();
    expect(window.history.pushState).toBe(originalPushState);
    vi.useRealTimers();
  });
});
