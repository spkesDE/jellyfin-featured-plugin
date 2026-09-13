<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigMultiPicker from '../components/ConfigMultiPicker.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import FilterRuleEditor from '../components/FilterRuleEditor.vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';
import { namedOptions } from '../libs/options';

const store = useConfigStore();
const historyCleared = ref(false);
const historyClearing = ref(false);
const historyUserIds = ref<string[]>([]);
const ratingOptions = (): SelectOption[] => store.ratings.value.map((rating) => ({ value: rating.value, label: rating.label }));
const historyUserOptions = computed<SelectOption[]>(() => namedOptions(store.users.value));

async function clearHistory(): Promise<void> {
  if (!historyUserIds.value.length
    || !window.confirm(t('filter.clearHistoryConfirm', { count: historyUserIds.value.length }))) return;
  historyClearing.value = true;
  try {
    await store.clearDisplayHistory(historyUserIds.value);
    historyCleared.value = true;
    window.setTimeout(() => { historyCleared.value = false; }, 1800);
  } finally {
    historyClearing.value = false;
  }
}
</script>

<template>
  <section id="featuredPanel-filters" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-filters">
    <div class="ec-filterLayout">
      <ConfigCard class="ec-filterGlobal" :title="t('filter.globalRules')" :help="t('filter.globalRulesHelp')">
        <FilterRuleEditor :filters="store.config.GlobalFilters" />
        <p v-if="!store.config.GlobalFilters.length" class="jmp-note">{{ t('filter.noGlobalRules') }}</p>
      </ConfigCard>

      <div class="ec-filterSecondary">
        <ConfigCard :title="t('filter.diversityTitle')" :help="t('filter.diversityHelp')">
          <div class="ec-diversityGrid">
            <ConfigNumber v-model="store.config.MaximumItemsPerGenre" :label="t('filter.maximumPerGenre')"
              :help-text="t('filter.maximumPerGenreHelp')" :min="0" :max="100" :step="1" />
            <ConfigNumber v-model="store.config.MaximumItemsPerFranchise" :label="t('filter.maximumPerFranchise')"
              :help-text="t('filter.maximumPerFranchiseHelp')" :min="0" :max="100" :step="1" />
          </div>
        </ConfigCard>

        <ConfigCard :title="t('filter.resultLimits')" :help="t('filter.resultLimitsHelp')">
          <ConfigCheckbox v-model="store.config.EnableInfiniteLoading" :label="t('filter.continuous')" :help-text="t('filter.continuousHelp')" />
          <ConfigNumber
            v-if="!store.config.EnableInfiniteLoading"
            v-model="store.config.RandomMediaCount"
            :label="t('filter.maximumItems')"
            :min="1"
            :max="100"
            :step="1"
          />
          <ConfigSelect v-model="store.parentalRatingValue.value" :label="t('filter.maximumParental')" :options="ratingOptions()" />
        </ConfigCard>

        <ConfigCard :title="t('filter.rotationHistory')" :help="t('filter.rotationHistoryHelp')">
          <ConfigNumber v-model="store.config.RepeatCooldownDays" :label="t('filter.cooldownDays')" :help-text="t('filter.cooldownHelp')" :min="0" :max="3650" :step="1" />
          <ConfigCheckbox v-model="store.config.RelaxRepeatCooldownWhenNeeded" :label="t('filter.relaxCooldown')" :help-text="t('filter.relaxCooldownHelp')" />
          <ConfigMultiPicker
            v-model="historyUserIds"
            :label="t('filter.historyUsers')"
            :options="historyUserOptions"
            :empty-text="t('filter.noHistoryUsers')"
          />
          <button
            type="button"
            class="raised emby-button ec-secondaryAction"
            :disabled="!historyUserIds.length || historyClearing"
            @click="clearHistory"
          >
            <span class="material-icons" aria-hidden="true">delete_sweep</span>{{ historyCleared ? t('filter.historyCleared') : t('filter.clearHistory') }}
          </button>
        </ConfigCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ec-filterLayout {
  display: grid;
  gap: 1rem;
}

.ec-filterSecondary {
  align-items: stretch;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ec-diversityGrid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }

@media (max-width: 900px) {
  .ec-filterSecondary {
    grid-template-columns: 1fr;
  }
  .ec-diversityGrid { grid-template-columns: 1fr; }
}
</style>
