export type FreshRequestKind = 'initial' | 'remount';

/** Reuses one recent or in-flight response without coupling cache lifetime to a mounted DOM node. */
export class FreshResponseCache<T> {
  private generation = 0;
  private recent: { scope: string; value: T; receivedAt: number } | null = null;
  private pending: { scope: string; promise: Promise<T> } | null = null;
  private readonly requestedScopes = new Set<string>();

  constructor(
    private readonly reuseMilliseconds: number,
    private readonly shouldRemember: (value: T) => boolean,
    private readonly onReuse: (kind: 'recent' | 'in-flight') => void = () => undefined
  ) {}

  clear(): void {
    this.generation += 1;
    this.recent = null;
    this.pending = null;
  }

  get(scope: string | null, request: (kind: FreshRequestKind) => Promise<T>, now = Date.now()): Promise<T> {
    if (scope && this.recent?.scope === scope && now - this.recent.receivedAt <= this.reuseMilliseconds) {
      this.onReuse('recent');
      return Promise.resolve(this.recent.value);
    }
    if (scope && this.pending?.scope === scope) {
      this.onReuse('in-flight');
      return this.pending.promise;
    }

    const requestScope = scope ?? 'unknown';
    const requestKind: FreshRequestKind = this.requestedScopes.has(requestScope) ? 'remount' : 'initial';
    this.requestedScopes.add(requestScope);
    const generation = this.generation;
    const promise = request(requestKind)
      .then((value) => {
        if (scope && generation === this.generation && this.shouldRemember(value)) {
          this.recent = { scope, value, receivedAt: Date.now() };
        }
        return value;
      })
      .finally(() => {
        if (this.pending?.promise === promise) this.pending = null;
      });
    if (scope) this.pending = { scope, promise };
    return promise;
  }
}
