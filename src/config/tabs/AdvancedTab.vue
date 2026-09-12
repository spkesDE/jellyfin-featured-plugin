<script setup lang="ts">
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const injectionOptions: SelectOption[] = [
  { value: 'automatic', label: t('advanced.automatic') },
  { value: 'file-transformation', label: t('advanced.fileTransformation') },
  { value: 'javascript-injector', label: t('advanced.javascriptInjector') }
];
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
      <ConfigCard :title="t('advanced.credits')" :help="t('advanced.creditsHelp')">
        <a href="https://github.com/lachlandcp/jellyfin-editors-choice-plugin" target="_blank" rel="noopener noreferrer">
          {{ t('advanced.originalProject') }}
        </a>
      </ConfigCard>
      <ConfigCard class="ec-diagnostics-section" :title="t('advanced.diagnostics')" :help="t('advanced.diagnosticsHelp')">
        <ConfigCheckbox v-model="store.config.Debug" :label="t('advanced.debug')" />
        <button type="button" class="raised emby-button ec-diagnosticsButton" :disabled="store.diagnosticsLoading.value"
          @click="store.runDiagnostics">
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
      </ConfigCard>
    </div>
  </section>
</template>
