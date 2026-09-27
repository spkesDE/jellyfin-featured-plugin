import { describe, expect, it } from 'vitest';
import { PreferencesActionStatus } from '../../src/preferencesActionStatus';

describe('PreferencesActionStatus', () => {
  it('shares busy and actionable error handling across preference mutations', async () => {
    const dialog = document.createElement('form');
    const button = document.createElement('button');
    const status = document.createElement('div');
    dialog.append(button, status);
    const actions = new PreferencesActionStatus(dialog, status);
    let release!: () => void;
    const pending = actions.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    expect(button.disabled).toBe(true);
    release();
    await expect(pending).resolves.toBe(true);
    expect(button.disabled).toBe(false);

    await expect(actions.run(() => Promise.reject(new Error('server unavailable')))).resolves.toBe(false);
    expect(status.textContent).toContain('server unavailable');
    expect(button.disabled).toBe(false);
  });
});
