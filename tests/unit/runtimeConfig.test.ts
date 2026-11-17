import { describe, expect, it } from 'vitest';
import { applyResponseDisplaySettings, config } from '../../src/config';

describe('runtime display settings', () => {
  it('takes the display settings of the latest response and keeps script-only values', () => {
    const injection = config.frontendInjectionMethod;
    const before = { ...config };

    applyResponseDisplaySettings({
      heroHeightMode: 'compact',
      useHeroLayout: !config.useHeroLayout,
      hideOnTvLayout: !config.hideOnTvLayout,
      heading: 'Holiday picks',
      bannerHeight: 'not a number',
      items: []
    });

    expect(config.heroHeightMode).toBe('compact');
    expect(config.useHeroLayout).toBe(!before.useHeroLayout);
    expect(config.hideOnTvLayout).toBe(!before.hideOnTvLayout);
    expect(config.heading).toBe('Holiday picks');
    expect(config.bannerHeight).toBe(before.bannerHeight);
    expect(config.frontendInjectionMethod).toBe(injection);
    expect('items' in config).toBe(false);
    Object.assign(config, before);
  });
});
