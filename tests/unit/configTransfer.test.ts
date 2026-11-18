import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { createDefaultConfig } from '../../src/config/libs/configDefaults';
import { createPresetFromConfig } from '../../src/config/libs/configFactories';
import {
  CONFIG_EXPORT_FORMAT,
  ConfigImportError,
  configExportFileName,
  mergeImportedPresets,
  parseConfigImport,
  serializeConfigExport
} from '../../src/config/libs/configTransfer';

describe('configuration import and export', () => {
  it('round-trips an exported configuration', () => {
    const config = createDefaultConfig();
    config.AutoplayInterval = 17;
    config.Presets = [{ ...createPresetFromConfig(config), Name: 'Holidays' }];

    const exported = serializeConfigExport(config, new Date('2026-11-18T10:00:00Z'));
    const payload = JSON.parse(exported);
    const imported = parseConfigImport(exported);

    expect(payload.format).toBe(CONFIG_EXPORT_FORMAT);
    expect(payload.exportedAt).toBe('2026-11-18T10:00:00.000Z');
    expect(imported.AutoplayInterval).toBe(17);
    expect(imported.Presets.map((preset) => preset.Name)).toEqual(['Holidays']);
  });

  it('exports and merges the reactive editor state', () => {
    const config = reactive(createDefaultConfig());
    config.Presets = [createPresetFromConfig(createDefaultConfig())];

    expect(() => serializeConfigExport(config)).not.toThrow();
    expect(mergeImportedPresets(config.Presets, config.Presets)).toHaveLength(2);
  });

  it('accepts a configuration saved directly from Jellyfin and fills missing defaults', () => {
    const imported = parseConfigImport(JSON.stringify({ UseHeroLayout: false, SourceRules: [] }));

    expect(imported.UseHeroLayout).toBe(false);
    expect(imported.AutoplayInterval).toBe(createDefaultConfig().AutoplayInterval);
  });

  it('rejects files that are not a configuration', () => {
    const reason = (text: string): string | undefined => {
      try {
        parseConfigImport(text);
        return undefined;
      } catch (error) {
        return error instanceof ConfigImportError ? error.reason : 'other';
      }
    };

    expect(reason('{ not json')).toBe('invalid-json');
    expect(reason('[1, 2]')).toBe('not-a-configuration');
    expect(reason('{"name": "something else"}')).toBe('not-a-configuration');
  });

  it('appends imported presets and renames clashing ids', () => {
    const base = createPresetFromConfig(createDefaultConfig());
    const clash = { ...base, Name: 'Imported' };
    const fresh = { ...createPresetFromConfig(createDefaultConfig()), Name: 'Fresh' };

    const merged = mergeImportedPresets([base], [clash, fresh]);

    expect(merged.map((preset) => preset.Name)).toEqual([base.Name, 'Imported', 'Fresh']);
    expect(new Set(merged.map((preset) => preset.Id)).size).toBe(3);
    expect(merged[2].Id).toBe(fresh.Id);
  });

  it('names the export file after the local date', () => {
    expect(configExportFileName(new Date(2026, 10, 18, 23, 30))).toBe('jellyfin-featured-config-2026-11-18.json');
  });
});
