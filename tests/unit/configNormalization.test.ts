import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../src/config/libs/configDefaults';
import { createPresetFromConfig } from '../../src/config/libs/configFactories';
import { normalizeHeroLayoutSettings, normalizeTrailerSourcePriority } from '../../src/config/libs/configNormalization';

describe('configuration normalization boundaries', () => {
  it('normalizes root and preset hero layouts through the same rules', () => {
    const root = createDefaultConfig();
    const preset = createPresetFromConfig(root).Layout;
    for (const target of [root, preset]) {
      target.HeroFadeStart = 90;
      target.HeroFadeEnd = 10;
      target.HeroFadeCurve = 'soft';
      target.HeroHeightMode = 'invalid' as typeof target.HeroHeightMode;
      target.HeroFadePoints = [
        { Position: 20, Fade: 30 },
        { Position: 20, Fade: 80 }
      ];
      normalizeHeroLayoutSettings(target);
      expect(target.HeroFadeStart).toBe(50);
      expect(target.HeroFadeEnd).toBe(100);
      expect(target.HeroFadeCurve).toBe('custom');
      expect(target.HeroHeightMode).toBe('standard');
      expect(target.HeroFadePoints).toEqual([
        { Position: 0, Fade: 0 },
        { Position: 20, Fade: 30 },
        { Position: 100, Fade: 100 }
      ]);
    }
  });

  it('maps the legacy trailer fallback flag consistently', () => {
    expect(
      normalizeTrailerSourcePriority({ TrailerSourcePriority: 'prefer_local' }, { FallBackToRemoteTrailers: false })
    ).toBe('local_only');
    expect(
      normalizeTrailerSourcePriority({ TrailerSourcePriority: 'remote_only' }, { FallBackToRemoteTrailers: false })
    ).toBe('remote_only');
  });
});
