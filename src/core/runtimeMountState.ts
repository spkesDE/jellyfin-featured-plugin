/**
 * Mutable mount ownership for the runtime. Keeping it here makes lifecycle invalidation
 * and retry backoff testable without starting a MutationObserver or a Jellyfin page.
 */
export class RuntimeMountState<TMount> {
  readonly instances = new Map<Element, TMount>();
  readonly placeholders = new Map<Element, HTMLElement>();
  readonly pendingContainers = new Set<Element>();
  private mountFailureAttempts = 0;
  private nextMountAttemptAt = 0;
  private lifecycleGeneration = 0;

  get lifecycleToken(): number {
    return this.lifecycleGeneration;
  }

  beginLifecycle(): number {
    this.lifecycleGeneration += 1;
    return this.lifecycleGeneration;
  }

  canAttemptMount(now = Date.now()): boolean {
    return this.nextMountAttemptAt <= now;
  }

  recordMountFailure(now = Date.now()): number {
    this.mountFailureAttempts += 1;
    const retryDelay = Math.min(
      MAX_MOUNT_RETRY_DELAY_MS,
      INITIAL_MOUNT_RETRY_DELAY_MS * 3 ** Math.min(this.mountFailureAttempts - 1, 3)
    );
    this.nextMountAttemptAt = now + retryDelay;
    return retryDelay;
  }

  resetMountFailures(): void {
    this.mountFailureAttempts = 0;
    this.nextMountAttemptAt = 0;
  }

  hasTrackedMount(): boolean {
    return this.instances.size > 0 || this.placeholders.size > 0 || this.pendingContainers.size > 0;
  }

  clear(destroyMount: (mount: TMount) => void): void {
    this.instances.forEach(destroyMount);
    this.instances.clear();
    this.placeholders.forEach((placeholder) => placeholder.remove());
    this.placeholders.clear();
    this.pendingContainers.clear();
    this.resetMountFailures();
  }
}

const INITIAL_MOUNT_RETRY_DELAY_MS = 10_000;
const MAX_MOUNT_RETRY_DELAY_MS = 300_000;
