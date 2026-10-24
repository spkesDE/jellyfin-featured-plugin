<script setup lang="ts">
import { computed, watch } from 'vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigSwitch from '../components/ConfigSwitch.vue';
import { t, type TranslationKey } from '../../i18n';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const injectionOptions = computed<SelectOption[]>(() => [
  { value: 'automatic', label: t('advanced.automatic') },
  {
    value: 'file-transformation',
    label: optionLabel('advanced.fileTransformation', store.injectionMethodsAvailable.value['file-transformation']),
    disabled: !store.injectionMethodsAvailable.value['file-transformation']
  },
  {
    value: 'javascript-injector',
    label: optionLabel('advanced.javascriptInjector', store.injectionMethodsAvailable.value['javascript-injector']),
    disabled: !store.injectionMethodsAvailable.value['javascript-injector']
  },
  {
    value: 'direct',
    label: optionLabel('advanced.directInjection', store.injectionMethodsAvailable.value.direct),
    disabled: !store.injectionMethodsAvailable.value.direct
  }
]);

const summary = computed(() =>
  [
    injectionOptions.value.find((option) => option.value === store.config.FrontendInjectionMethod)?.label,
    store.config.EnablePreparedCache ? t('advanced.summaryCacheOn') : t('advanced.summaryCacheOff'),
    store.config.Debug ? t('advanced.summaryDebug') : null
  ]
    .filter(Boolean)
    .join(' · ')
);

const diagnosticsEntries = computed(() => {
  const result = store.diagnostics.value;
  if (!result) return [];
  const entries: { key: TranslationKey; value: string | number; wide?: boolean }[] = [
    {
      key: 'advanced.frontendStatus',
      value: `${result.frontendInjection ? '✓' : '✗'} ${result.frontendInjectionMethod}`
    },
    { key: 'advanced.jellyfinVersion', value: result.jellyfinVersion },
    { key: 'advanced.pluginVersion', value: result.pluginVersion },
    { key: 'advanced.currentUser', value: result.currentUser },
    { key: 'advanced.matchingItems', value: result.matchingItems },
    { key: 'advanced.eligibleItems', value: result.eligibleItems },
    { key: 'advanced.heroItemsReturned', value: result.heroItemsReturned },
    { key: 'advanced.manualListsActive', value: result.manualListsActive },
    { key: 'advanced.userProfileApplied', value: result.userProfileApplied ? '✓' : '–' },
    { key: 'advanced.repeatCooldown', value: result.repeatCooldownDays },
    { key: 'advanced.historyEntries', value: result.historyEntries },
    { key: 'advanced.basePath', value: result.basePath || '–' },
    { key: 'advanced.sources', value: result.sources.join(', '), wide: true },
    { key: 'advanced.cache', value: result.cache, wide: true }
  ];
  return entries;
});

function optionLabel(key: TranslationKey, available: boolean): string {
  const label = t(key);
  return available ? label : `${label} ${t('advanced.unavailable')}`;
}

function showRestartReminder(): void {
  const message = t('advanced.injectionRestartRequired');
  if (window.Dashboard?.alert) window.Dashboard.alert(message);
  else window.alert(message);
}

watch(
  () => store.config.FrontendInjectionMethod,
  (method, previousMethod) => {
    if (method !== previousMethod && !store.loading.value) showRestartReminder();
  },
  { flush: 'sync' }
);
</script>

<template>
  <section
    id="featuredPanel-advanced"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-advanced"
  >
    <ConfigListHeader :title="t('tab.advanced')" :help-text="t('advanced.headerHelp')" :summary="summary" />

    <div class="featured-advancedRow">
      <ConfigCard :title="t('advanced.frontendInjection')">
        <ConfigSelect
          v-model="store.config.FrontendInjectionMethod"
          :label="t('advanced.frontendInjectionMethod')"
          :help-text="t('advanced.frontendInjectionHelp')"
          :options="injectionOptions"
        />
        <ConfigSwitch
          v-model="store.config.EnableFrontendBootstrap"
          :label="t('advanced.frontendBootstrap')"
          :help-text="t('advanced.frontendBootstrapHelp')"
        />
      </ConfigCard>
      <ConfigCard :title="t('advanced.performance')">
        <ConfigSwitch
          v-model="store.config.ReduceImageSize"
          :label="t('advanced.reducedImages')"
          :help-text="t('advanced.performanceHelp')"
        />
        <ConfigSwitch
          v-model="store.config.EnablePreparedCache"
          :label="t('advanced.preparedCache')"
          :help-text="t('advanced.preparedCacheHelp')"
        />
      </ConfigCard>
    </div>

    <ConfigCard
      class="featured-diagnosticsCard"
      :title="t('advanced.diagnostics')"
      :help="t('advanced.diagnosticsHelp')"
    >
      <template #actions>
        <div class="featured-diagnosticsActions">
          <label class="featured-debugToggle">
            <span>{{ t('advanced.debugShort') }}</span>
            <ConfigSwitch v-model="store.config.Debug" :label="t('advanced.debug')" hide-label />
          </label>
          <button
            type="button"
            class="raised button-submit emby-button featured-addSourceButton"
            :disabled="store.diagnosticsLoading.value"
            @click="store.runDiagnostics()"
          >
            <span class="material-icons" aria-hidden="true">{{
              store.diagnosticsLoading.value ? 'hourglass_top' : 'play_arrow'
            }}</span>
            <span>{{ store.diagnosticsLoading.value ? t('advanced.testingHero') : t('advanced.testHero') }}</span>
          </button>
        </div>
      </template>

      <p v-if="store.diagnosticsError.value" class="featured-diagnosticsError" role="alert">
        {{ t('advanced.diagnosticsFailed', { error: store.diagnosticsError.value }) }}
      </p>

      <template v-if="store.diagnostics.value">
        <dl class="featured-diagnosticsGrid" aria-live="polite">
          <div
            v-for="entry in diagnosticsEntries"
            :key="entry.key"
            class="featured-diagnosticsItem"
            :class="{ 'is-wide': entry.wide }"
          >
            <dt>{{ t(entry.key) }}</dt>
            <dd>{{ entry.value }}</dd>
          </div>
        </dl>

        <div v-if="store.diagnostics.value.rules?.length" class="featured-ruleDiagnostics">
          <h4 class="featured-diagnosticsHeading">{{ t('advanced.ruleBreakdown') }}</h4>
          <div class="featured-ruleDiagnosticsScroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t('advanced.ruleSource') }}</th>
                  <th>{{ t('advanced.ruleCandidates') }}</th>
                  <th>{{ t('advanced.ruleFiltered') }}</th>
                  <th>{{ t('advanced.ruleIneligible') }}</th>
                  <th>{{ t('advanced.ruleCooldown') }}</th>
                  <th>{{ t('advanced.ruleAllocated') }}</th>
                  <th>{{ t('advanced.ruleDuplicates') }}</th>
                  <th>{{ t('advanced.ruleDiversity') }}</th>
                  <th>{{ t('advanced.ruleRelaxed') }}</th>
                  <th>{{ t('advanced.ruleReturned') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rule in store.diagnostics.value.rules" :key="rule.id">
                  <td>{{ rule.type }}{{ rule.fallback ? ` · ${t('source.fallback')}` : '' }}</td>
                  <td>{{ rule.candidateItems }}</td>
                  <td>{{ rule.filteredOut }}</td>
                  <td>{{ rule.ineligible }}</td>
                  <td>{{ rule.cooldownExcluded }}</td>
                  <td>{{ rule.allocated }}</td>
                  <td>{{ rule.duplicates }}</td>
                  <td>{{ rule.diversitySkipped }}</td>
                  <td>{{ rule.cooldownRelaxed }}</td>
                  <td>{{ rule.returned }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <p v-else-if="!store.diagnosticsError.value" class="jmp-note featured-diagnosticsEmpty">
        {{ t('advanced.diagnosticsEmpty') }}
      </p>
    </ConfigCard>

    <footer class="featured-advancedCredits">
      <span>{{ t('advanced.creditsHelp') }}</span>
      <a href="https://github.com/lachlandcp/jellyfin-editors-choice-plugin" target="_blank" rel="noopener noreferrer">
        {{ t('advanced.originalProject') }}
      </a>
    </footer>
  </section>
</template>

<style scoped>
.featured-advancedRow {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 1rem;
}
.featured-advancedRow :deep(.jmp-subsection),
.featured-diagnosticsCard {
  margin-bottom: 0;
}
.featured-advancedRow :deep(.selectContainer) {
  margin-bottom: 0.5rem;
}
.featured-diagnosticsActions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  justify-content: flex-end;
}
.featured-diagnosticsActions .featured-addSourceButton {
  min-height: 2.35rem;
  padding: 0.45rem 0.9rem;
}
.featured-diagnosticsActions .material-icons {
  font-size: 1.15rem;
}
.featured-debugToggle {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
}
.featured-debugToggle > span {
  font-size: 0.9rem;
  opacity: 0.75;
}
.featured-diagnosticsError {
  margin: 0 0 0.75rem;
}
.featured-diagnosticsEmpty {
  margin: 0;
}
.featured-diagnosticsGrid {
  display: grid;
  gap: 0.6rem 1.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}
.featured-diagnosticsItem {
  border-bottom: 1px solid var(--featured-theme-divider);
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding-bottom: 0.5rem;
}
.featured-diagnosticsItem.is-wide {
  grid-column: 1 / -1;
}
.featured-diagnosticsItem dt {
  color: var(--featured-theme-text-secondary);
  font-size: 0.75rem;
}
.featured-diagnosticsItem dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.featured-ruleDiagnostics {
  margin-top: 1.25rem;
}
.featured-diagnosticsHeading {
  color: var(--featured-theme-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0 0 0.25rem;
  text-transform: uppercase;
}
.featured-advancedCredits {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.75rem;
  gap: 0.25rem 0.6rem;
  justify-content: center;
  opacity: 0.45;
  padding: 1rem 1rem 0;
  text-align: center;
}
.featured-advancedCredits a {
  color: inherit;
}

@media (max-width: 1000px) {
  .featured-advancedRow {
    grid-template-columns: minmax(0, 1fr);
  }
  .featured-diagnosticsGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .featured-diagnosticsActions {
    justify-content: space-between;
  }
  .featured-diagnosticsGrid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
