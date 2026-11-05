import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import { createConfigAppMounter } from '../../src/config/appMounts';

function addMountPoint(): HTMLElement {
  const mountPoint = document.createElement('div');
  mountPoint.id = 'FeaturedConfigApp';
  document.body.appendChild(mountPoint);
  return mountPoint;
}

function createFakeApps() {
  const apps: { mount: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }[] = [];
  const factory = () => {
    const app = { mount: vi.fn(), unmount: vi.fn() };
    apps.push(app);
    return app as unknown as App;
  };
  return { apps, factory };
}

describe('createConfigAppMounter', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('mounts a page once when it is shown again', () => {
    const { apps, factory } = createFakeApps();
    const prepare = vi.fn();
    const mount = createConfigAppMounter(factory, prepare);
    const mountPoint = addMountPoint();

    mount();
    mount();

    expect(apps).toHaveLength(1);
    expect(apps[0].mount).toHaveBeenCalledWith(mountPoint);
    expect(apps[0].unmount).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('unmounts the app of a dropped page and mounts the rebuilt one', () => {
    const { apps, factory } = createFakeApps();
    const mount = createConfigAppMounter(factory, vi.fn());
    addMountPoint();
    mount();

    document.body.replaceChildren();
    const rebuilt = addMountPoint();
    mount();

    expect(apps).toHaveLength(2);
    expect(apps[0].unmount).toHaveBeenCalledTimes(1);
    expect(apps[1].mount).toHaveBeenCalledWith(rebuilt);
    expect(apps[1].unmount).not.toHaveBeenCalled();
  });

  it('mounts a new page even while an older one is still cached in the document', () => {
    const { apps, factory } = createFakeApps();
    const mount = createConfigAppMounter(factory, vi.fn());
    addMountPoint();
    mount();

    const rebuilt = addMountPoint();
    mount();

    expect(apps).toHaveLength(2);
    expect(apps[0].unmount).not.toHaveBeenCalled();
    expect(apps[1].mount).toHaveBeenCalledWith(rebuilt);
  });
});
