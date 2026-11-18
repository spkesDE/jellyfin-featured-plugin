<script setup lang="ts">
import { ref } from 'vue';
import ConfigCard from './ConfigCard.vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';
import {
  ConfigImportError,
  configExportFileName,
  mergeImportedPresets,
  parseConfigImport,
  serializeConfigExport
} from '../libs/configTransfer';

type ImportMode = 'all' | 'presets';

const store = useConfigStore();
const fileInput = ref<HTMLInputElement | null>(null);
const importMode = ref<ImportMode>('all');
const message = ref<{ text: string; error: boolean } | null>(null);

function exportConfiguration(): void {
  const blob = new Blob([serializeConfigExport(store.config)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = configExportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  message.value = { text: t('backup.exported'), error: false };
}

function chooseFile(mode: ImportMode): void {
  importMode.value = mode;
  message.value = null;
  fileInput.value?.click();
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const imported = parseConfigImport(await file.text());
    if (importMode.value === 'presets') {
      if (!imported.Presets.length) {
        message.value = { text: t('backup.noPresets'), error: true };
        return;
      }
      store.config.Presets = mergeImportedPresets(store.config.Presets, imported.Presets);
      const count = imported.Presets.length;
      message.value = {
        text: count === 1 ? t('backup.presetsImportedOne') : t('backup.presetsImported', { count }),
        error: false
      };
    } else {
      if (!window.confirm(t('backup.replaceConfirm'))) return;
      Object.assign(store.config, imported);
      message.value = { text: t('backup.imported'), error: false };
    }
  } catch (error) {
    const reason = error instanceof ConfigImportError ? error.reason : 'invalid-json';
    message.value = {
      text: reason === 'invalid-json' ? t('backup.invalidJson') : t('backup.notAConfiguration'),
      error: true
    };
  }
}
</script>

<template>
  <ConfigCard class="featured-backupCard" :title="t('backup.title')" :help="t('backup.help')">
    <div class="featured-backupActions">
      <button type="button" class="featured-textButton" @click="exportConfiguration">
        <span class="material-icons" aria-hidden="true">download</span>
        {{ t('backup.export') }}
      </button>
      <button type="button" class="featured-textButton" :disabled="store.loading.value" @click="chooseFile('all')">
        <span class="material-icons" aria-hidden="true">upload</span>
        {{ t('backup.importAll') }}
      </button>
      <button type="button" class="featured-textButton" :disabled="store.loading.value" @click="chooseFile('presets')">
        <span class="material-icons" aria-hidden="true">playlist_add</span>
        {{ t('backup.importPresets') }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        hidden
        :aria-label="t('backup.importAll')"
        @change="importFile"
      />
    </div>
    <p
      v-if="message"
      class="featured-backupMessage"
      :class="{ 'is-error': message.error }"
      :role="message.error ? 'alert' : 'status'"
    >
      {{ message.text }}
    </p>
  </ConfigCard>
</template>

<style scoped>
.featured-backupCard {
  margin-top: 1rem;
}
.featured-backupActions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}
.featured-backupMessage {
  color: var(--featured-theme-text-secondary);
  font-size: 0.85rem;
  margin: 0.75rem 0 0;
}
.featured-backupMessage.is-error {
  color: var(--featured-theme-error, #ff6b6b);
}
</style>
