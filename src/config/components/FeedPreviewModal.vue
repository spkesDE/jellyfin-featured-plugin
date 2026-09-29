<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n';
import ConfigSelect from './ConfigSelect.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const dialog = ref<HTMLElement | null>(null);
const userOptions = computed(() => [
  { value: '', label: t('feedPreview.currentUser') },
  ...store.users.value.map((user) => ({ value: user.Id, label: user.Name }))
]);
const presetOptions = computed(() => [
  { value: '', label: t('feedPreview.activePreset') },
  { value: '__default__', label: t('feedPreview.defaultConfig') },
  ...store.config.Presets.map((preset) => ({ value: preset.Id, label: preset.Name }))
]);

function refresh(): void {
  void store.runFeedPreview(store.feedPreviewUserId.value, store.feedPreviewPresetId.value);
}

function sourceLabel(source: string): string {
  return t(`source.type.${source.toLowerCase()}` as Parameters<typeof t>[0]);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && store.feedPreviewOpen.value) store.closeFeedPreview();
}

onMounted(() => document.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown));
watch(
  () => store.feedPreviewOpen.value,
  async (open) => {
    if (!open) return;
    await nextTick();
    dialog.value?.focus();
  }
);
</script>

<template>
  <div v-if="store.feedPreviewOpen.value" class="featured-feedPreviewOverlay" @click.self="store.closeFeedPreview()">
    <section
      ref="dialog"
      class="featured-feedPreviewDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="featured-feedPreviewTitle"
      tabindex="-1"
    >
      <header class="featured-feedPreviewHeader featured-configSplitHeader">
        <div>
          <h2 id="featured-feedPreviewTitle">{{ t('feedPreview.title') }}</h2>
          <p>{{ t('feedPreview.help') }}</p>
        </div>
        <button
          type="button"
          class="featured-feedPreviewClose"
          :aria-label="t('feedPreview.close')"
          @click="store.closeFeedPreview()"
        >
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </header>

      <div class="featured-feedPreviewControls">
        <ConfigSelect v-model="store.feedPreviewUserId.value" :label="t('feedPreview.user')" :options="userOptions" />
        <ConfigSelect
          v-model="store.feedPreviewPresetId.value"
          :label="t('feedPreview.preset')"
          :options="presetOptions"
        />
        <button
          type="button"
          class="raised button-submit emby-button featured-primaryAction"
          :disabled="store.feedPreviewLoading.value"
          @click="refresh"
        >
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ store.feedPreviewLoading.value ? t('feedPreview.loading') : t('feedPreview.refresh') }}
        </button>
      </div>

      <p v-if="store.feedPreviewError.value" class="featured-feedPreviewError">
        {{ t('feedPreview.failed', { error: store.feedPreviewError.value }) }}
      </p>
      <div v-else-if="store.feedPreviewLoading.value && !store.feedPreview.value" class="featured-feedPreviewEmpty">
        {{ t('feedPreview.loading') }}
      </div>
      <template v-else-if="store.feedPreview.value">
        <div class="featured-feedPreviewContext">
          <span>{{ t('feedPreview.asUser', { name: store.feedPreview.value.userName }) }}</span>
          <span>{{ store.feedPreview.value.activePresetName || t('feedPreview.defaultConfig') }}</span>
          <span v-if="store.feedPreview.value.userProfileApplied">{{ t('feedPreview.profileApplied') }}</span>
        </div>

        <ol v-if="store.feedPreview.value.items?.length" class="featured-feedPreviewItems">
          <li v-for="item in store.feedPreview.value.items" :key="item.id">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.productionYear ? `${item.mediaType} · ${item.productionYear}` : item.mediaType }}</span>
            </div>
            <span class="featured-feedPreviewReason" :title="t('feedPreview.whyHelp')">
              {{ t('feedPreview.selectedBy', { source: sourceLabel(item.sourceType) }) }}
            </span>
          </li>
        </ol>
        <p v-else class="featured-feedPreviewEmpty">{{ t('feedPreview.noItems') }}</p>

        <h3>{{ t('feedPreview.diagnostics') }}</h3>
        <div class="featured-feedPreviewStats">
          <div v-for="rule in store.feedPreview.value.rules ?? []" :key="rule.id">
            <span>{{ sourceLabel(rule.type) }}</span>
            <strong>{{ t('feedPreview.selectedCount', { count: rule.returned }) }}</strong>
          </div>
          <div>
            <span>{{ t('feedPreview.duplicates') }}</span
            ><strong>{{ store.feedPreview.value.duplicatesRemoved }}</strong>
          </div>
          <div>
            <span>{{ t('feedPreview.cooldown') }}</span
            ><strong>{{ store.feedPreview.value.cooldownExcluded }}</strong>
          </div>
          <div>
            <span>{{ t('feedPreview.diversity') }}</span
            ><strong>{{ store.feedPreview.value.diversitySkipped }}</strong>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.featured-feedPreviewOverlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 1rem;
  position: fixed;
  z-index: 9999;
}
.featured-feedPreviewDialog {
  background: var(--featured-theme-background, #181818);
  border: 1px solid var(--featured-theme-divider);
  border-radius: 1rem;
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
  max-height: calc(100vh - 2rem);
  max-width: 72rem;
  overflow: auto;
  padding: 1.5rem;
  width: 100%;
}
.featured-feedPreviewHeader h2 {
  margin: 0;
}
.featured-feedPreviewHeader p {
  margin: 0.25rem 0 0;
  opacity: 0.72;
}
.featured-feedPreviewClose {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0.35rem;
}
.featured-feedPreviewControls {
  align-items: end;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) max-content;
  margin: 1.5rem 0;
}
.featured-feedPreviewControls > :deep(.selectContainer) {
  margin-bottom: 0;
}
.featured-feedPreviewControls > .featured-primaryAction {
  min-height: 2.7rem;
  white-space: nowrap;
}
.featured-feedPreviewItems {
  counter-reset: preview-item;
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0 0 1.75rem;
  padding: 0;
}
.featured-feedPreviewItems li {
  counter-increment: preview-item;
}
.featured-feedPreviewItems li::before {
  color: var(--featured-theme-text-secondary);
  content: counter(preview-item) '.';
  font-weight: 700;
  text-align: right;
}
.featured-feedPreviewItems li {
  align-items: center;
  background: var(--featured-theme-action-hover);
  border-radius: 0.55rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: 1.6rem minmax(0, 1fr) max-content;
  padding: 0.65rem 0.8rem;
}
.featured-feedPreviewItems li div {
  display: grid;
  flex: 1 1 auto;
  gap: 0.15rem;
  min-width: 0;
}
.featured-feedPreviewItems li div span,
.featured-feedPreviewReason {
  font-size: 0.85rem;
  opacity: 0.72;
}
.featured-feedPreviewReason {
  text-align: right;
}
.featured-feedPreviewContext {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.featured-feedPreviewContext span {
  background: var(--featured-theme-contained);
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
}
.featured-feedPreviewStats {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.featured-feedPreviewStats div {
  align-items: center;
  border-bottom: 1px solid var(--featured-theme-divider);
  display: flex;
  justify-content: space-between;
  padding: 0.55rem 0.25rem;
}
.featured-feedPreviewError {
  color: var(--featured-theme-error-light);
}
.featured-feedPreviewEmpty {
  opacity: 0.7;
  padding: 1.5rem 0;
  text-align: center;
}
@media (max-width: 700px) {
  .featured-feedPreviewControls,
  .featured-feedPreviewStats {
    grid-template-columns: 1fr;
  }
  .featured-feedPreviewControls > .featured-primaryAction {
    width: 100%;
  }
  .featured-feedPreviewItems li {
    align-items: start;
    grid-template-columns: 1.6rem minmax(0, 1fr);
  }
  .featured-feedPreviewReason {
    grid-column: 2;
    text-align: left;
  }
}
</style>
