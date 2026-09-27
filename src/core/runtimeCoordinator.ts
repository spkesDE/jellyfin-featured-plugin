import { RouteObserver } from './routeObserver';
import { RuntimeMountState } from './runtimeMountState';

const PRESET_BOUNDARY_GRACE_MS = 250;
const MAX_BROWSER_TIMER_DELAY_MS = 2_147_000_000;

interface RuntimeCoordinatorOptions {
  scan: (removeInactive: boolean) => void;
  routeChanged: () => void;
  mutationsObserved: (mutations: MutationRecord[]) => void;
  presetBoundaryReached: () => void;
}

/**
 * Owns browser observers, deferred scans, preset timers, and mount generations.
 * Stopping the coordinator symmetrically releases every browser-owned callback.
 */
export class RuntimeCoordinator<TMount> {
  readonly mounts = new RuntimeMountState<TMount>();
  private readonly routes: RouteObserver;
  private observer: MutationObserver | null = null;
  private scanFrame: number | null = null;
  private removeInactiveOnNextScan = false;
  private presetRefreshTimer: number | null = null;

  constructor(private readonly options: RuntimeCoordinatorOptions) {
    this.routes = new RouteObserver(options.routeChanged);
  }

  get isStarted(): boolean {
    return this.observer !== null;
  }

  start(observationRoot: Node): void {
    if (this.observer) return;
    this.observer = new MutationObserver(this.options.mutationsObserved);
    this.observer.observe(observationRoot, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
    this.routes.start();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.routes.stop();
    if (this.scanFrame !== null) window.cancelAnimationFrame(this.scanFrame);
    this.scanFrame = null;
    this.removeInactiveOnNextScan = false;
    this.clearPresetRefresh();
  }

  scheduleScan(removeInactive = false): void {
    this.removeInactiveOnNextScan ||= removeInactive;
    if (this.scanFrame !== null) return;
    this.scanFrame = window.requestAnimationFrame(() => {
      this.scanFrame = null;
      const shouldRemoveInactive = this.removeInactiveOnNextScan;
      this.removeInactiveOnNextScan = false;
      this.options.scan(shouldRemoveInactive);
    });
  }

  schedulePresetRefresh(nextPresetChange?: string): void {
    this.clearPresetRefresh();
    if (!nextPresetChange) return;
    const boundary = new Date(nextPresetChange).getTime();
    if (!Number.isFinite(boundary)) return;
    const remaining = boundary - Date.now();
    if (remaining <= 0) {
      this.presetRefreshTimer = window.setTimeout(this.firePresetBoundary, PRESET_BOUNDARY_GRACE_MS);
      return;
    }
    const delay = Math.min(remaining + PRESET_BOUNDARY_GRACE_MS, MAX_BROWSER_TIMER_DELAY_MS);
    this.presetRefreshTimer = window.setTimeout(() => {
      this.presetRefreshTimer = null;
      if (Date.now() < boundary) this.schedulePresetRefresh(nextPresetChange);
      else this.options.presetBoundaryReached();
    }, delay);
  }

  private clearPresetRefresh(): void {
    if (this.presetRefreshTimer !== null) window.clearTimeout(this.presetRefreshTimer);
    this.presetRefreshTimer = null;
  }

  private firePresetBoundary = (): void => {
    this.presetRefreshTimer = null;
    this.options.presetBoundaryReached();
  };
}
