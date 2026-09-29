import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_PREFERENCES_CHANGED_EVENT } from '../../src/constants';
import { PreferencesActionStatus } from '../../src/preferencesActionStatus';
import { createDismissalsSection } from '../../src/preferencesDismissals';
import type { FeaturedDismissalsResponse } from '../../src/types/featured';

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));
vi.mock('../../src/core/apiClient', () => ({ requestJson }));

function createDismissals(): FeaturedDismissalsResponse {
  return {
    policy: { enabled: true, showButton: true, allowTitle: true, allowSeries: true, allowFranchise: true },
    entries: [
      {
        id: 'dismissal-1',
        scope: 'title',
        key: 'item-1',
        name: '<img src=x onerror=alert(1)>',
        itemId: 'item-1',
        dismissedAt: '2026-09-26T00:00:00Z'
      }
    ]
  };
}

describe('createDismissalsSection', () => {
  beforeEach(() => requestJson.mockReset().mockResolvedValue({}));

  it('renders dynamic names as text and applies undo through the shared action state', async () => {
    const dialog = document.createElement('form');
    const status = document.createElement('div');
    const dismissals = createDismissals();
    const section = createDismissalsSection(dismissals, new PreferencesActionStatus(dialog, status));
    dialog.append(section, status);
    const changed = vi.fn();
    document.addEventListener(USER_PREFERENCES_CHANGED_EVENT, changed, { once: true });

    expect(section.querySelector('img')).toBeNull();
    expect(section.textContent).toContain('<img src=x onerror=alert(1)>');
    section.querySelector<HTMLButtonElement>('[aria-label]')?.click();
    await vi.waitFor(() => expect(requestJson).toHaveBeenCalled());

    expect(requestJson).toHaveBeenCalledWith('featured/dismissals/undo', {
      method: 'POST',
      body: { dismissalId: 'dismissal-1' }
    });
    await vi.waitFor(() => expect(dismissals.entries).toEqual([]));
    expect(section.querySelector('.featured-preferences-help')).not.toBeNull();
    expect(section.querySelector<HTMLButtonElement>('.raised')?.hidden).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
  });
});
