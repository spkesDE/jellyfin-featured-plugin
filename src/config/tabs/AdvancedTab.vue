<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import { t, type TranslationKey } from '../../i18n';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const diagnosticsOpen = ref(false);
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

watch(
  () => [store.diagnostics.value, store.diagnosticsError.value],
  ([result, error]) => {
    if (result || error) diagnosticsOpen.value = true;
  }
);

function syncDiagnosticsOpen(event: Event): void {
  diagnosticsOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

function runDiagnostics(): void {
  diagnosticsOpen.value = true;
  void store.runDiagnostics();
}
</script>

<template>
  <section id="featuredPanel-advanced" class="jmp-section jmp-section-plain" role="tabpanel"
    aria-labelledby="featuredTab-advanced">
    <div class="jmp-subgrid">
      <ConfigCard :title="t('advanced.frontendInjection')">
        <ConfigSelect v-model="store.config.FrontendInjectionMethod" :label="t('advanced.frontendInjectionMethod')"
          :help-text="t('advanced.frontendInjectionHelp')" :options="injectionOptions" />
        <ConfigCheckbox v-model="store.config.EnableFrontendBootstrap" :label="t('advanced.frontendBootstrap')"
          :help-text="t('advanced.frontendBootstrapHelp')" />
      </ConfigCard>
      <ConfigCard :title="t('advanced.performance')">
        <ConfigCheckbox v-model="store.config.ReduceImageSize" :label="t('advanced.reducedImages')" :help-text="t('advanced.performanceHelp')" />
        <ConfigCheckbox v-model="store.config.EnablePreparedCache" :label="t('advanced.preparedCache')" :help-text="t('advanced.preparedCacheHelp')" />
      </ConfigCard>
      <details class="ec-diagnostics-section" :open="diagnosticsOpen" @toggle="syncDiagnosticsOpen">
        <summary class="ec-advancedSummary">
          <span class="material-icons" aria-hidden="true">troubleshoot</span>
          <span><strong>{{ t('advanced.diagnostics') }}</strong><small>{{ t('advanced.diagnosticsHelp') }}</small></span>
          <span class="material-icons ec-advancedChevron" aria-hidden="true">expand_more</span>
        </summary>
        <div class="ec-diagnosticsBody">
        <ConfigCheckbox v-model="store.config.Debug" :label="t('advanced.debug')" />
        <button type="button" class="raised emby-button ec-diagnosticsButton" :disabled="store.diagnosticsLoading.value"
          @click="runDiagnostics">
          {{ store.diagnosticsLoading.value ? t('advanced.testingHero') : t('advanced.testHero') }}
        </button>
        <p v-if="store.diagnosticsError.value" class="ec-diagnosticsError" role="alert">
          {{ t('advanced.diagnosticsFailed', { error: store.diagnosticsError.value }) }}
        </p>
        <dl v-if="store.diagnostics.value" class="ec-diagnosticsResults" aria-live="polite">
          <div>
            <dt>{{ t('advanced.frontendStatus') }}</dt>
            <dd>{{ store.diagnostics.value.frontendInjection ? '✓' : '✗' }} {{
              store.diagnostics.value.frontendInjectionMethod }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.jellyfinVersion') }}</dt>
            <dd>{{ store.diagnostics.value.jellyfinVersion }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.pluginVersion') }}</dt>
            <dd>{{ store.diagnostics.value.pluginVersion }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.currentUser') }}</dt>
            <dd>{{ store.diagnostics.value.currentUser }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.sources') }}</dt>
            <dd>{{ store.diagnostics.value.sources.join(', ') }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.matchingItems') }}</dt>
            <dd>{{ store.diagnostics.value.matchingItems }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.eligibleItems') }}</dt>
            <dd>{{ store.diagnostics.value.eligibleItems }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.heroItemsReturned') }}</dt>
            <dd>{{ store.diagnostics.value.heroItemsReturned }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.manualListsActive') }}</dt>
            <dd>{{ store.diagnostics.value.manualListsActive }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.userProfileApplied') }}</dt>
            <dd>{{ store.diagnostics.value.userProfileApplied ? '✓' : '–' }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.repeatCooldown') }}</dt>
            <dd>{{ store.diagnostics.value.repeatCooldownDays }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.historyEntries') }}</dt>
            <dd>{{ store.diagnostics.value.historyEntries }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.basePath') }}</dt>
            <dd>{{ store.diagnostics.value.basePath }}</dd>
          </div>
          <div>
            <dt>{{ t('advanced.cache') }}</dt>
            <dd>{{ store.diagnostics.value.cache }}</dd>
          </div>
        </dl>
        <div v-if="store.diagnostics.value?.rules?.length" class="ec-ruleDiagnostics">
          <h3>{{ t('advanced.ruleBreakdown') }}</h3>
          <div class="ec-ruleDiagnosticsScroll">
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
        </div>
      </details>

      <footer class="ec-advancedCredits">
        <span>{{ t('advanced.creditsHelp') }}</span>
        <a href="https://github.com/lachlandcp/jellyfin-editors-choice-plugin" target="_blank" rel="noopener noreferrer">
          {{ t('advanced.originalProject') }}
        </a>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.ec-diagnostics-section { background: var(--ec-config-card-background); border: 1px solid var(--ec-theme-divider); border-radius: .9rem; grid-column: 1 / -1; overflow: hidden; }
.ec-advancedSummary { align-items: center; cursor: pointer; display: grid; gap: .75rem; grid-template-columns: auto minmax(0, 1fr) auto; list-style: none; padding: .9rem 1rem; }
.ec-advancedSummary::-webkit-details-marker { display: none; }
.ec-advancedSummary > span:nth-child(2) { display: grid; gap: .1rem; }
.ec-advancedSummary small { font-size: .78rem; font-weight: 400; opacity: .65; }
.ec-advancedChevron { transition: transform .16s ease; }
.ec-diagnostics-section[open] .ec-advancedChevron { transform: rotate(180deg); }
.ec-diagnosticsBody { border-top: 1px solid var(--ec-theme-divider); padding: 1rem; }
.ec-advancedCredits { display: flex; flex-wrap: wrap; font-size: .8rem; gap: .35rem .75rem; grid-column: 1 / -1; justify-content: center; opacity: .58; padding: .35rem 1rem 0; text-align: center; }
.ec-advancedCredits a { color: inherit; }
</style>
