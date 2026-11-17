import type { RuntimeConfig } from './types/config';
import { createRuntimeConfigDefaults } from './config/libs/defaults';

export const config: RuntimeConfig = {
  ...createRuntimeConfigDefaults(),
  ...(window.JellyfinFeaturedPluginConfig ?? {})
};

/**
 * The script carries the settings that were active when the page loaded. A later response reflects the preset that
 * applies now, so its shared display settings replace those values for placeholders and mount checks.
 */
export function applyResponseDisplaySettings(response: object): void {
  const target = config as unknown as Record<string, unknown>;
  const source = response as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    if (!(key in source)) continue;
    const value = source[key];
    const current = target[key];
    if (current === null || current === undefined || value === null || typeof value === typeof current) {
      target[key] = value;
    }
  }
}
