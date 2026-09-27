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
});
