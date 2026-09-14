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
watch(() => store.feedPreviewOpen.value, async (open) => {
  if (!open) return;
  await nextTick();
  dialog.value?.focus();
});
</script>

<template>
  <div v-if="store.feedPreviewOpen.value" class="ec-feedPreviewOverlay" @click.self="store.closeFeedPreview()">
    <section ref="dialog" class="ec-feedPreviewDialog" role="dialog" aria-modal="true" aria-labelledby="ec-feedPreviewTitle" tabindex="-1">
      <header class="ec-feedPreviewHeader">
        <div>
          <h2 id="ec-feedPreviewTitle">{{ t('feedPreview.title') }}</h2>
          <p>{{ t('feedPreview.help') }}</p>
        </div>
        <button type="button" class="ec-feedPreviewClose" :aria-label="t('feedPreview.close')" @click="store.closeFeedPreview()">
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </header>

      <div class="ec-feedPreviewControls">
        <ConfigSelect v-model="store.feedPreviewUserId.value" :label="t('feedPreview.user')" :options="userOptions" />
        <ConfigSelect v-model="store.feedPreviewPresetId.value" :label="t('feedPreview.preset')" :options="presetOptions" />
        <button type="button" class="raised button-submit emby-button ec-primaryAction" :disabled="store.feedPreviewLoading.value" @click="refresh">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ store.feedPreviewLoading.value ? t('feedPreview.loading') : t('feedPreview.refresh') }}
        </button>
      </div>

      <p v-if="store.feedPreviewError.value" class="ec-feedPreviewError">
        {{ t('feedPreview.failed', { error: store.feedPreviewError.value }) }}
      </p>
      <div v-else-if="store.feedPreviewLoading.value && !store.feedPreview.value" class="ec-feedPreviewEmpty">
        {{ t('feedPreview.loading') }}
      </div>
      <template v-else-if="store.feedPreview.value">
        <div class="ec-feedPreviewContext">
          <span>{{ t('feedPreview.asUser', { name: store.feedPreview.value.userName }) }}</span>
          <span>{{ store.feedPreview.value.activePresetName || t('feedPreview.defaultConfig') }}</span>
          <span v-if="store.feedPreview.value.userProfileApplied">{{ t('feedPreview.profileApplied') }}</span>
        </div>

        <ol v-if="store.feedPreview.value.items?.length" class="ec-feedPreviewItems">
          <li v-for="item in store.feedPreview.value.items" :key="item.id">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.productionYear ? `${item.mediaType} · ${item.productionYear}` : item.mediaType }}</span>
            </div>
            <span class="ec-feedPreviewReason" :title="t('feedPreview.whyHelp')">
              {{ t('feedPreview.selectedBy', { source: sourceLabel(item.sourceType) }) }}
            </span>
          </li>
        </ol>
        <p v-else class="ec-feedPreviewEmpty">{{ t('feedPreview.noItems') }}</p>

        <h3>{{ t('feedPreview.diagnostics') }}</h3>
        <div class="ec-feedPreviewStats">
          <div v-for="rule in (store.feedPreview.value.rules ?? [])" :key="rule.id">
            <span>{{ sourceLabel(rule.type) }}</span>
            <strong>{{ t('feedPreview.selectedCount', { count: rule.returned }) }}</strong>
          </div>
          <div><span>{{ t('feedPreview.duplicates') }}</span><strong>{{ store.feedPreview.value.duplicatesRemoved }}</strong></div>
          <div><span>{{ t('feedPreview.cooldown') }}</span><strong>{{ store.feedPreview.value.cooldownExcluded }}</strong></div>
          <div><span>{{ t('feedPreview.diversity') }}</span><strong>{{ store.feedPreview.value.diversitySkipped }}</strong></div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ec-feedPreviewOverlay { align-items: center; background: rgba(0, 0, 0, .72); display: flex; inset: 0; justify-content: center; padding: 1rem; position: fixed; z-index: 9999; }
.ec-feedPreviewDialog { background: var(--ec-theme-background, #181818); border: 1px solid var(--ec-theme-divider); border-radius: 1rem; box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, .5); box-sizing: border-box; max-height: calc(100vh - 2rem); max-width: 72rem; overflow: auto; padding: 1.5rem; width: 100%; }
.ec-feedPreviewHeader { align-items: flex-start; display: flex; gap: 1rem; justify-content: space-between; }
.ec-feedPreviewHeader h2 { margin: 0; }
.ec-feedPreviewHeader p { margin: .25rem 0 0; opacity: .72; }
.ec-feedPreviewClose { background: transparent; border: 0; color: inherit; cursor: pointer; padding: .35rem; }
.ec-feedPreviewControls { align-items: end; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) max-content; margin: 1.5rem 0; }
.ec-feedPreviewControls > :deep(.selectContainer) { margin-bottom: 0; }
.ec-feedPreviewControls > .ec-primaryAction { min-height: 2.7rem; white-space: nowrap; }
.ec-feedPreviewItems { counter-reset: preview-item; display: grid; gap: .5rem; list-style: none; margin: 0 0 1.75rem; padding: 0; }
.ec-feedPreviewItems li { counter-increment: preview-item; }
.ec-feedPreviewItems li::before { color: var(--ec-theme-text-secondary); content: counter(preview-item) "."; font-weight: 700; text-align: right; }
.ec-feedPreviewItems li { align-items: center; background: var(--ec-theme-action-hover); border-radius: .55rem; display: grid; gap: 1rem; grid-template-columns: 1.6rem minmax(0, 1fr) max-content; padding: .65rem .8rem; }
.ec-feedPreviewItems li div { display: grid; flex: 1 1 auto; gap: .15rem; min-width: 0; }
.ec-feedPreviewItems li div span, .ec-feedPreviewReason { font-size: .85rem; opacity: .72; }
.ec-feedPreviewReason { text-align: right; }
.ec-feedPreviewContext { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.25rem; }
.ec-feedPreviewContext span { background: var(--ec-theme-contained); border-radius: 999px; padding: .35rem .65rem; }
.ec-feedPreviewStats { display: grid; gap: .5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ec-feedPreviewStats div { align-items: center; border-bottom: 1px solid var(--ec-theme-divider); display: flex; justify-content: space-between; padding: .55rem .25rem; }
.ec-feedPreviewError { color: var(--ec-theme-error-light); }
.ec-feedPreviewEmpty { opacity: .7; padding: 1.5rem 0; text-align: center; }
@media (max-width: 700px) {
  .ec-feedPreviewControls, .ec-feedPreviewStats { grid-template-columns: 1fr; }
  .ec-feedPreviewControls > .ec-primaryAction { width: 100%; }
  .ec-feedPreviewItems li { align-items: start; grid-template-columns: 1.6rem minmax(0, 1fr); }
  .ec-feedPreviewReason { grid-column: 2; text-align: left; }
}
</style>
