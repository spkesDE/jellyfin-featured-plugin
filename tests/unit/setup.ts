import { afterEach } from 'vitest';

afterEach(() => {
  document.body.textContent = '';
  document.head.querySelectorAll('[data-test-style]').forEach((element) => element.remove());
  window.localStorage.clear();
});
