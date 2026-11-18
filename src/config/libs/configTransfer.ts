import { toRaw } from 'vue';
import { cloneJsonValue } from '../../core/clone';
import { createId } from '../../core/id';
import { PLUGIN_VERSION } from '../../constants';
import type { FeaturedPluginConfig, FeaturedPreset } from '../../types/config';
import { normalizeConfig } from './defaults';

export const CONFIG_EXPORT_FORMAT = 'jellyfin-featured-config';

interface ConfigExport {
  format: typeof CONFIG_EXPORT_FORMAT;
  pluginVersion: string;
  exportedAt: string;
  configuration: FeaturedPluginConfig;
}

export type ConfigImportErrorReason = 'invalid-json' | 'not-a-configuration';

export class ConfigImportError extends Error {
  readonly reason: ConfigImportErrorReason;

  constructor(reason: ConfigImportErrorReason) {
    super(reason);
    this.reason = reason;
  }
}

export function serializeConfigExport(config: FeaturedPluginConfig, now = new Date()): string {
  const payload: ConfigExport = {
    format: CONFIG_EXPORT_FORMAT,
    pluginVersion: PLUGIN_VERSION,
    exportedAt: now.toISOString(),
    // The editor passes its reactive store; structured cloning needs the plain object behind it.
    configuration: cloneJsonValue(toRaw(config))
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function configExportFileName(now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `jellyfin-featured-config-${date}.json`;
}

/**
 * Reads an export file, or a configuration saved directly from Jellyfin, and normalizes it like a loaded
 * configuration so files from older plugin versions still import.
 */
export function parseConfigImport(text: string): FeaturedPluginConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigImportError('invalid-json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new ConfigImportError('not-a-configuration');
  const wrapper = parsed as Partial<ConfigExport>;
  const configuration = wrapper.format === CONFIG_EXPORT_FORMAT ? wrapper.configuration : parsed;
  if (!configuration || typeof configuration !== 'object' || !looksLikeConfiguration(configuration))
    throw new ConfigImportError('not-a-configuration');
  return normalizeConfig(configuration);
}

/** Adds imported presets after the existing ones; a preset whose id is already taken gets a new id. */
export function mergeImportedPresets(
  existing: readonly FeaturedPreset[],
  imported: readonly FeaturedPreset[]
): FeaturedPreset[] {
  const ids = new Set(existing.map((preset) => preset.Id));
  return [
    ...existing.map((preset) => cloneJsonValue(toRaw(preset))),
    ...imported.map((preset) => {
      const copy = cloneJsonValue(toRaw(preset));
      if (ids.has(copy.Id)) copy.Id = createId();
      ids.add(copy.Id);
      return copy;
    })
  ];
}

function looksLikeConfiguration(value: object): boolean {
  return ['SourceRules', 'Presets', 'GlobalFilters', 'ManualLists', 'UseHeroLayout'].some((key) => key in value);
}
