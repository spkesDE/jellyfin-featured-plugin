/**
 * Loads the stylesheets of a real Jellyfin Web install through the dev server's `/web` proxy, so the harness renders
 * with the same base styles (emby inputs, buttons, checkboxes, icon font) as the dashboard. Without a configured
 * JELLYFIN_URL the proxy is absent and the harness keeps its standalone styling.
 */
export async function loadJellyfinStyles(): Promise<boolean> {
  const runtime = await fetchScript('/web/runtime.bundle.js');
  const index = await fetchText('/web/index.html');
  if (!runtime || !index) return false;

  const entryStyles = [...index.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((match) => match[1]);
  const files = [...entryStyles, ...cssChunkFiles(runtime), 'themes/dark/theme.css'];
  // Jellyfin's styles go first, in Jellyfin's own order, so the plugin's styles keep their cascade priority.
  const anchor = document.head.firstChild;
  await Promise.all(files.map((file) => addStylesheet(`/web/${file}`, anchor)));
  document.documentElement.dir = 'ltr';
  document.documentElement.classList.add('featured-dev-jellyfin', 'layout-desktop');
  document.documentElement.dataset.theme = 'dark';
  return true;
}

/**
 * Webpack's mini-css-extract runtime maps chunk ids to optional names and content hashes. Reading the map keeps the
 * loader working across Jellyfin updates, whose CSS file names change with every build.
 */
function cssChunkFiles(runtime: string): string[] {
  const start = runtime.indexOf('miniCssF=');
  if (start < 0) return [];
  const objects = [...runtime.slice(start, start + 200_000).matchAll(/\{(\d+:"[^"]*"(?:,\d+:"[^"]*")*)\}/g)]
    .slice(0, 2)
    .map((match) => Object.fromEntries([...match[1].matchAll(/(\d+):"([^"]*)"/g)].map((pair) => [pair[1], pair[2]])));
  if (objects.length < 2) return [];
  const [names, hashes] = objects;
  return Object.entries(hashes).map(([id, hash]) => `${names[id] ?? id}.${hash}.css`);
}

async function fetchScript(url: string): Promise<string | null> {
  const response = await fetch(url).catch(() => null);
  const type = response?.headers.get('content-type') ?? '';
  return response?.ok && type.includes('javascript') ? response.text() : null;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url).catch(() => null);
  return response?.ok ? response.text() : null;
}

function addStylesheet(href: string, before: ChildNode | null): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.insertBefore(link, before);
  });
}
