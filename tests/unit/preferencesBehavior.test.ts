import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_PREFERENCES_CHANGED_EVENT } from '../../src/constants';
import type { FeaturedPreferencesBootstrapResponse } from '../../src/types/featured';

const mocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
  loadPreferencesBootstrap: vi.fn(),
  invalidatePreferencesBootstrap: vi.fn()
}));
vi.mock('../../src/core/apiClient', () => ({ requestJson: mocks.requestJson }));
vi.mock('../../src/preferencesApi', () => ({
  loadPreferencesBootstrap: mocks.loadPreferencesBootstrap,
  invalidatePreferencesBootstrap: mocks.invalidatePreferencesBootstrap,
  preloadPreferencesDialog: vi.fn()
}));

import { openPreferencesDialog } from '../../src/preferences';

describe('preferences dialog behaviour', () => {
  beforeEach(() => {
    mocks.requestJson.mockReset().mockResolvedValue({});
    mocks.invalidatePreferencesBootstrap.mockReset();
    mocks.loadPreferencesBootstrap.mockReset().mockResolvedValue(createBootstrap());
  });

  it('saves and resets through the same observable dialog lifecycle', async () => {
    const changed = vi.fn();
    document.addEventListener(USER_PREFERENCES_CHANGED_EVENT, changed);

    await openPreferencesDialog();
    const reset = document.querySelector<HTMLButtonElement>('.ec-preferences-reset');
    expect(reset, document.body.innerHTML).not.toBeNull();
    reset!.click();
    await vi.waitFor(() =>
      expect(mocks.requestJson).toHaveBeenCalledWith('featured/preferences', { method: 'PUT', body: { reset: true } })
    );
    await vi.waitFor(() => expect(document.querySelector('.ec-preferences-backdrop')).toBeNull());

    await openPreferencesDialog();
    const dialog = document.querySelector<HTMLFormElement>('.ec-preferences-dialog');
    expect(dialog).not.toBeNull();
    dialog!.requestSubmit();
    await vi.waitFor(() =>
      expect(mocks.requestJson).toHaveBeenCalledWith(
        'featured/preferences',
        expect.objectContaining({ method: 'PUT', body: { preferences: expect.any(Object) } })
      )
    );

    await vi.waitFor(() => expect(mocks.invalidatePreferencesBootstrap).toHaveBeenCalledTimes(2));
    expect(changed).toHaveBeenCalledTimes(2);
    document.removeEventListener(USER_PREFERENCES_CHANGED_EVENT, changed);
  });
});

function createBootstrap(): FeaturedPreferencesBootstrapResponse {
  const display = {
    enableBackgroundTrailers: false,
    showRating: false,
    showDescription: false,
    showYear: false,
    showRuntime: false,
    showFavoriteButton: false,
    showPlaystateButton: false,
    showDismissalButton: false
  };
  const effective = {
    sourceEnabled: {},
    sourceWeights: {},
    display,
    preferredGenres: [],
    excludedGenres: [],
    unplayedBoost: 25,
    favouriteBoost: 20,
    inProgressSeriesBoost: 30,
    repeatCooldownDays: 0,
    repeatCooldownHours: 0
  };
  return {
    current: {
      hasOverrides: false,
      preferences: {
        sourceEnabled: {},
        sourceWeights: {},
        display: Object.fromEntries(Object.keys(display).map((key) => [key, null])),
        preferredGenres: null,
        excludedGenres: null,
        unplayedBoost: null,
        favouriteBoost: null,
        inProgressSeriesBoost: null,
        repeatCooldownDays: null,
        repeatCooldownHours: null
      },
      effective,
      defaults: effective
    },
    options: {
      policy: {
        enabled: true,
        allowSourceSelection: true,
        allowSourceWeights: true,
        allowPreferredGenres: true,
        allowUnplayedBoost: true,
        allowFavouriteBoost: true,
        allowInProgressSeriesBoost: true,
        allowRepeatCooldown: false
      },
      sources: [],
      genres: []
    },
    dismissals: {
      policy: { enabled: false, showButton: false, allowTitle: false, allowSeries: false, allowFranchise: false },
      entries: []
    }
  } as FeaturedPreferencesBootstrapResponse;
}
