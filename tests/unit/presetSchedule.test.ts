import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../src/config/libs/configDefaults';
import { createPresetFromConfig } from '../../src/config/libs/configFactories';
import { presetScheduleState, resolveActivePreset } from '../../src/config/libs/presetSchedule';
import type { FeaturedPreset } from '../../src/types/config';

function preset(overrides: Partial<FeaturedPreset>): FeaturedPreset {
  return { ...createPresetFromConfig(createDefaultConfig()), Enabled: true, TimeZoneId: 'UTC', ...overrides };
}

describe('preset schedule resolution', () => {
  const now = new Date('2026-12-24T20:00:00Z'); // Thursday

  it('picks the highest priority among active presets', () => {
    const christmas = preset({
      Id: 'xmas',
      ScheduleType: 'annual',
      AnnualStart: '12-01',
      AnnualEnd: '12-26',
      Priority: 1
    });
    const evening = preset({
      Id: 'evening',
      ScheduleType: 'weekly',
      DaysOfWeek: [4],
      StartTime: '18:00',
      EndTime: '23:00',
      Priority: 5
    });
    const active = resolveActivePreset([christmas, evening], now);
    expect(active?.preset.Id).toBe('evening');
    expect(active?.endsAt?.toISOString()).toBe('2026-12-24T23:00:00.000Z');
  });

  it('handles windows that wrap past midnight and the year end', () => {
    const night = preset({ ScheduleType: 'weekly', DaysOfWeek: [3], StartTime: '22:00', EndTime: '02:00' });
    expect(resolveActivePreset([night], new Date('2026-12-24T01:00:00Z'))?.preset).toBe(night);
    const winter = preset({ ScheduleType: 'annual', AnnualStart: '12-20', AnnualEnd: '01-06' });
    expect(resolveActivePreset([winter], new Date('2027-01-03T12:00:00Z'))?.preset).toBe(winter);
    expect(resolveActivePreset([winter], new Date('2027-02-01T12:00:00Z'))).toBeNull();
  });

  it('reports one-time and disabled states', () => {
    expect(presetScheduleState(preset({ Enabled: false }), now)).toBe('disabled');
    expect(presetScheduleState(preset({ StartsAt: '2027-01-01T00:00:00Z' }), now)).toBe('scheduled');
    expect(presetScheduleState(preset({ EndsAt: '2026-01-01T00:00:00Z' }), now)).toBe('expired');
    expect(presetScheduleState(preset({}), now)).toBe('active');
    expect(presetScheduleState(preset({ ScheduleType: 'weekly', DaysOfWeek: [1] }), now)).toBe('recurring');
  });
});
