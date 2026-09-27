import { describe, expect, it, vi } from 'vitest';
import { FreshResponseCache } from '../../src/core/freshResponseCache';

describe('FreshResponseCache', () => {
  it('joins in-flight work and reuses a recent response for the same scope', async () => {
    let resolveRequest!: (value: string) => void;
    const request = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        })
    );
    const cache = new FreshResponseCache<string>(30_000, Boolean);

    const first = cache.get('user-a', request);
    const joined = cache.get('user-a', request);
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest('response');
    await expect(Promise.all([first, joined])).resolves.toEqual(['response', 'response']);

    await expect(cache.get('user-a', request)).resolves.toBe('response');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('invalidates old asynchronous results across lifecycle resets', async () => {
    const resolvers: Array<(value: string) => void> = [];
    const cache = new FreshResponseCache<string>(30_000, Boolean);
    const request = () => new Promise<string>((resolve) => resolvers.push(resolve));

    const stale = cache.get('user-a', request);
    cache.clear();
    resolvers.shift()?.('stale');
    await stale;

    const fresh = cache.get('user-a', request);
    resolvers.shift()?.('fresh');
    await expect(fresh).resolves.toBe('fresh');
  });
});
