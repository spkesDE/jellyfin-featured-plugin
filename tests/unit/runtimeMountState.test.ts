import { describe, expect, it, vi } from 'vitest';
import { RuntimeMountState } from '../../src/core/runtimeMountState';

describe('RuntimeMountState', () => {
  it('invalidates work with a monotonically increasing lifecycle token', () => {
    const state = new RuntimeMountState<HTMLElement>();

    expect(state.lifecycleToken).toBe(0);
    expect(state.beginLifecycle()).toBe(1);
    expect(state.beginLifecycle()).toBe(2);
  });

  it('backs off repeated failures and can reset explicitly', () => {
    const state = new RuntimeMountState<HTMLElement>();

    expect(state.recordMountFailure(1_000)).toBe(10_000);
    expect(state.canAttemptMount(10_999)).toBe(false);
    expect(state.recordMountFailure(20_000)).toBe(30_000);
    state.resetMountFailures();
    expect(state.canAttemptMount(20_000)).toBe(true);
  });

  it('destroys tracked mounts and removes placeholders as one owned lifecycle', () => {
    const state = new RuntimeMountState<HTMLElement>();
    const container = document.createElement('div');
    const mount = document.createElement('section');
    const placeholder = document.createElement('section');
    document.body.append(placeholder);
    state.instances.set(container, mount);
    state.placeholders.set(container, placeholder);
    state.pendingContainers.add(container);
    const destroy = vi.fn();

    state.clear(destroy);

    expect(destroy.mock.calls[0]?.[0]).toBe(mount);
    expect(placeholder.isConnected).toBe(false);
    expect(state.hasTrackedMount()).toBe(false);
  });
});
