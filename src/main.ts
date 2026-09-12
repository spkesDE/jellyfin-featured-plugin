import styles from './styles/featured.css';
import { destroy, refresh, start } from './runtime';
import { PLUGIN_VERSION } from './constants';

const STYLE_ID = 'jellyfin-featured-styles';
const existingApi = window.JellyfinFeatured;

if (existingApi) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', existingApi.start, { once: true });
  } else {
    existingApi.start();
  }
} else {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const api = { version: PLUGIN_VERSION, start, destroy, refresh };
  window.JellyfinFeatured = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
