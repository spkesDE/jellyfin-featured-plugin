<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigGrid from '../components/ConfigGrid.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigSection from '../components/ConfigSection.vue';
import ConfigSwitch from '../components/ConfigSwitch.vue';
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
const ratingOptions = (): SelectOption[] =>
  store.ratings.value.map((rating) => ({ value: rating.value, label: rating.label }));
const historyUserOptions = computed<SelectOption[]>(() => namedOptions(store.users.value));

const summary = computed(() => {
  // Negative values follow each viewer's own Jellyfin parental setting, which needs no summary.
  const rating = store.parentalRatingValue.value.startsWith('-')
    ? undefined
    : ratingOptions().find((option) => option.value === store.parentalRatingValue.value)?.label;
  return [
    store.config.GlobalFilters.length === 1
      ? t('filter.summaryRulesOne')
      : t('filter.summaryRules', { count: store.config.GlobalFilters.length }),
    rating ? t('filter.summaryRating', { rating }) : null,
    store.config.RepeatCooldownDays === 1
      ? t('filter.summaryCooldownOne')
      : store.config.RepeatCooldownDays > 1
        ? t('filter.summaryCooldown', { days: store.config.RepeatCooldownDays })
        : null
  ]
    .filter(Boolean)
    .join(' · ');
});

async function clearHistory(): Promise<void> {
  if (
    !historyUserIds.value.length ||
    !window.confirm(t('filter.clearHistoryConfirm', { count: historyUserIds.value.length }))
  )
    return;
  historyClearing.value = true;
  try {
    await store.clearDisplayHistory(historyUserIds.value);
    historyCleared.value = true;
    window.setTimeout(() => {
      historyCleared.value = false;
    }, 1800);
  } finally {
    historyClearing.value = false;
  }
}
</script>

<template>
  <section
    id="featuredPanel-filters"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-filters"
  >
    <ConfigListHeader :title="t('filter.globalRules')" :help-text="t('filter.globalRulesHelp')" :summary="summary" />

    <div class="featured-filterLayout">
      <ConfigCard>
        <FilterRuleEditor
          :filters="store.config.GlobalFilters"
          :label="t('filter.rules')"
          :empty-text="t('filter.noGlobalRules')"
        />
        <ConfigSection :title="t('filter.contentRating')" class="featured-filterRating">
          <ConfigSelect
            v-model="store.parentalRatingValue.value"
            :label="t('filter.maximumParental')"
            :options="ratingOptions()"
          />
        </ConfigSection>
      </ConfigCard>

      <div class="featured-filterAside">
        <ConfigCard :title="t('filter.feedTitle')">
          <ConfigSwitch
            v-model="store.config.EnableInfiniteLoading"
            :label="t('filter.continuous')"
            :help-text="t('filter.continuousHelp')"
          />
          <ConfigSection :title="t('filter.diversityTitle')" :help-text="t('filter.diversityHelp')">
            <ConfigGrid>
              <ConfigNumber
                v-model="store.config.MaximumItemsPerGenre"
                :label="t('filter.maximumPerGenre')"
                :help-text="t('filter.maximumPerGenreHelp')"
                :zero-label="t('filter.off')"
                :min="0"
                :max="100"
                :step="1"
              />
              <ConfigNumber
                v-model="store.config.MaximumItemsPerFranchise"
                :label="t('filter.maximumPerFranchise')"
                :help-text="t('filter.maximumPerFranchiseHelp')"
                :zero-label="t('filter.off')"
                :min="0"
                :max="100"
                :step="1"
              />
            </ConfigGrid>
          </ConfigSection>
        </ConfigCard>

        <ConfigCard :title="t('filter.rotationHistory')" :help="t('filter.rotationHistoryHelp')">
          <ConfigNumber
            v-model="store.config.RepeatCooldownDays"
            :label="t('filter.cooldownDays')"
            :help-text="t('filter.cooldownHelp')"
            :zero-label="t('filter.off')"
            :min="0"
            :max="3650"
            :step="1"
          />
          <ConfigSwitch
            v-if="store.config.RepeatCooldownDays > 0"
            v-model="store.config.RelaxRepeatCooldownWhenNeeded"
            :label="t('filter.relaxCooldown')"
            :help-text="t('filter.relaxCooldownHelp')"
          />
          <ConfigSection :title="t('filter.historyTitle')">
            <ConfigMultiPicker
              v-model="historyUserIds"
              :label="t('filter.historyUsers')"
              :options="historyUserOptions"
              :empty-text="t('filter.noHistoryUsers')"
            />
            <div class="featured-historyActions">
              <button
                type="button"
                class="raised emby-button featured-secondaryAction"
                :disabled="!historyUserIds.length || historyClearing"
                :aria-busy="historyClearing"
                @click="clearHistory"
              >
                <span class="material-icons" aria-hidden="true">delete_sweep</span>
                {{ t('filter.clearHistory') }}
              </button>
              <span v-if="historyCleared" class="jmp-note" role="status">{{ t('filter.historyCleared') }}</span>
            </div>
          </ConfigSection>
        </ConfigCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.featured-filterLayout {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}
.featured-filterLayout :deep(.jmp-subsection) {
  margin-bottom: 0;
}
.featured-filterAside {
  display: grid;
  gap: 1rem;
}
.featured-filterAside :deep(.inputContainer) {
  margin-bottom: 0.5rem;
}
.featured-filterRating {
  margin-top: 0.9rem;
}
.featured-filterRating :deep(.selectContainer) {
  margin-bottom: 0;
  max-width: 24rem;
}

@media (max-width: 1000px) {
  .featured-filterLayout {
    grid-template-columns: minmax(0, 1fr);
  }
}
.featured-historyActions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
