import { describe, expect, it } from 'vitest';
import { serializePreferencesForm } from '../../src/preferencesForm';
import type { FeaturedPreferencesBootstrapResponse } from '../../src/types/featured';

describe('serializePreferencesForm', () => {
  it('stores only values that differ from the effective defaults', () => {
    const dialog = document.createElement('form');
    dialog.innerHTML = `
      <label data-source-id="source-a"><input type="checkbox" checked></label>
      <label data-source-id="source-a"><input type="number" value="80"></label>
      <label data-preference-key="unplayedBoost"><input type="number" value="30"></label>
      <button data-genre="Drama" data-genre-state="preferred"></button>
      <button data-genre="Horror" data-genre-state="excluded"></button>
      <select data-cooldown-hours><option value="24" selected>24</option></select>
    `;
    const current = {
      preferences: { display: {} },
      defaults: {
        display: {},
        sourceEnabled: { 'source-a': true },
        sourceWeights: { 'source-a': 50 },
        preferredGenres: [],
        excludedGenres: [],
        unplayedBoost: 25,
        favouriteBoost: 20,
        inProgressSeriesBoost: 30,
        repeatCooldownHours: 0
      }
    } as unknown as FeaturedPreferencesBootstrapResponse['current'];
    const options = {
      policy: { allowPreferredGenres: true }
    } as unknown as FeaturedPreferencesBootstrapResponse['options'];

    const result = serializePreferencesForm(dialog, current, options);

    expect(result.sourceEnabled).toEqual({});
    expect(result.sourceWeights).toEqual({ 'source-a': 80 });
    expect(result.unplayedBoost).toBe(30);
    expect(result.preferredGenres).toEqual(['Drama']);
    expect(result.excludedGenres).toEqual(['Horror']);
    expect(result.repeatCooldownHours).toBe(24);
  });

  it('stores the trailer mute state explicitly once it changes and keeps it when untouched', () => {
    const createDialog = (checked: boolean): HTMLFormElement => {
      const dialog = document.createElement('form');
      dialog.innerHTML = `<label data-display-preference-key="startTrailersMuted"><input type="checkbox" ${checked ? 'checked' : ''}></label>`;
      return dialog;
    };
    const current = {
      preferences: { display: { startTrailersMuted: false } },
      effective: { display: { startTrailersMuted: false } },
      defaults: { display: { startTrailersMuted: false } }
    } as unknown as FeaturedPreferencesBootstrapResponse['current'];
    const options = { policy: {} } as unknown as FeaturedPreferencesBootstrapResponse['options'];

    expect(serializePreferencesForm(createDialog(false), current, options).display.startTrailersMuted).toBe(false);
    expect(serializePreferencesForm(createDialog(true), current, options).display.startTrailersMuted).toBe(true);
  });

  it('stores the trailer volume once it changes and keeps the saved value when untouched', () => {
    const createDialog = (value: number): HTMLFormElement => {
      const dialog = document.createElement('form');
      dialog.innerHTML = `<label data-trailer-volume="true"><input type="range" min="0" max="100" value="${value}"></label>`;
      return dialog;
    };
    const options = { policy: {} } as unknown as FeaturedPreferencesBootstrapResponse['options'];
    const unsaved = {
      preferences: { display: {} },
      effective: { display: {} },
      defaults: { display: {} }
    } as unknown as FeaturedPreferencesBootstrapResponse['current'];
    const saved = {
      preferences: { display: { trailerVolume: 40 } },
      effective: { display: { trailerVolume: 40 } },
      defaults: { display: {} }
    } as unknown as FeaturedPreferencesBootstrapResponse['current'];

    // Without a saved volume the field shows 100; leaving it there keeps the browser's own volume.
    expect(serializePreferencesForm(createDialog(100), unsaved, options).display.trailerVolume).toBeNull();
    expect(serializePreferencesForm(createDialog(70), unsaved, options).display.trailerVolume).toBe(70);
    expect(serializePreferencesForm(createDialog(40), saved, options).display.trailerVolume).toBe(40);
    expect(serializePreferencesForm(createDialog(100), saved, options).display.trailerVolume).toBe(100);
    expect(serializePreferencesForm(createDialog(250), saved, options).display.trailerVolume).toBe(100);
  });
});
