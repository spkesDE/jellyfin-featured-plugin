import type { App } from 'vue';

const PENDING_MOUNT_POINT_SELECTOR = '#FeaturedConfigApp:not([data-vue-mounted="true"])';

/**
 * Jellyfin drops cached views without telling the page (a layout switch just clears the
 * container), so apps whose mount point left the document are unmounted on the next call.
 * That releases their global listeners and keeps at most the current page's app alive.
 */
export function createConfigAppMounter(createConfigApp: () => App, prepare: () => void): () => void {
  const mounted = new Map<HTMLElement, App>();

  return () => {
    for (const [mountPoint, app] of mounted) {
      if (mountPoint.isConnected) continue;
      mounted.delete(mountPoint);
      app.unmount();
    }

    const mountPoint = document.querySelector<HTMLElement>(PENDING_MOUNT_POINT_SELECTOR);
    if (!mountPoint) return;
    mountPoint.dataset.vueMounted = 'true';
    prepare();
    const app = createConfigApp();
    app.mount(mountPoint);
    mounted.set(mountPoint, app);
  };
}
