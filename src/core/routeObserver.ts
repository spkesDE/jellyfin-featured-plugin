type HistoryMethodName = 'pushState' | 'replaceState';

/** Owns route/view listeners and restores Jellyfin's original History methods on stop. */
export class RouteObserver {
  private started = false;
  private originalPushState: History['pushState'] | null = null;
  private originalReplaceState: History['replaceState'] | null = null;

  constructor(private readonly onRouteChanged: () => void) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('hashchange', this.onRouteChanged, { passive: true });
    window.addEventListener('popstate', this.onRouteChanged, { passive: true });
    document.addEventListener('viewshow', this.onRouteChanged, { passive: true });
    document.addEventListener('pageshow', this.onRouteChanged, { passive: true });

    if (!window.history || typeof window.history.pushState !== 'function') return;
    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;
    (['pushState', 'replaceState'] as HistoryMethodName[]).forEach((methodName) => {
      const original = window.history[methodName];
      const notify = this.onRouteChanged;
      window.history[methodName] = function patchedHistoryMethod(
        this: History,
        ...args: Parameters<History[HistoryMethodName]>
      ) {
        const result = original.apply(this, args as never);
        window.setTimeout(notify, 0);
        return result;
      } as History[HistoryMethodName];
    });
  }

  stop(): void {
    if (!this.started) return;
    window.removeEventListener('hashchange', this.onRouteChanged);
    window.removeEventListener('popstate', this.onRouteChanged);
    document.removeEventListener('viewshow', this.onRouteChanged);
    document.removeEventListener('pageshow', this.onRouteChanged);
    if (this.originalPushState) window.history.pushState = this.originalPushState;
    if (this.originalReplaceState) window.history.replaceState = this.originalReplaceState;
    this.originalPushState = null;
    this.originalReplaceState = null;
    this.started = false;
  }
}
