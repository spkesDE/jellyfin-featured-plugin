import { describe, expect, it } from 'vitest';
import { PreferencesDialogShell, createPreferencesActions } from '../../src/preferencesDialogShell';

describe('PreferencesDialogShell', () => {
  it('owns modal attachment, replacement, and focus restoration', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const shell = new PreferencesDialogShell();
    shell.attach();
    expect(shell.isConnected).toBe(true);

    const form = document.createElement('form');
    const close = document.createElement('button');
    close.className = 'ec-preferences-close';
    form.appendChild(close);
    shell.replaceContent(form);
    close.click();

    expect(shell.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('builds action labels as text and exposes one shared status element', () => {
    const actions = createPreferencesActions(true);

    expect(actions.root.querySelectorAll('button')).toHaveLength(2);
    expect(actions.status.getAttribute('aria-live')).toBe('polite');
  });
});
