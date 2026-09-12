import type { RuntimeConfig } from './types/config';
import { createRuntimeConfigDefaults } from './config/libs/defaults';

export const config: RuntimeConfig = {
  ...createRuntimeConfigDefaults(),
  ...(window.JellyfinFeaturedPluginConfig ?? {})
};
