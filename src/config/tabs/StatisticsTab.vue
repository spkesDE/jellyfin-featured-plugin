<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigSwitch from '../components/ConfigSwitch.vue';
import DailyBarChart, { type DailyBarDatum, type DailyBarSeries } from '../components/DailyBarChart.vue';
import StatisticsTable, { type StatisticsRow } from '../components/StatisticsTable.vue';
import { t } from '../../i18n';
import { requestJson } from '../../core/apiClient';
import { useConfigStore } from '../libs/store';

interface StatisticsDay {
  date: string;
  impressions: number;
  opens: number;
  plays: number;
}

interface StatisticsResponse {
  enabled: boolean;
  since: string;
  trackedItems: number;
  totalImpressions: number;
  totalOpens: number;
  totalPlays: number;
  days: StatisticsDay[];
  items: StatisticsRow[];
}

/** One color per measure across every chart, validated for color vision deficiencies on the dark surface. */
const COLORS = { impressions: '#3987e5', opens: '#d95926', plays: '#199e70' } as const;
const MAXIMUM_ROWS = 500;

const store = useConfigStore();
const statistics = ref<StatisticsResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const impressionSeries: DailyBarSeries[] = [
  { key: 'impressions', label: t('statistics.impressions'), color: COLORS.impressions }
];
const interactionSeries: DailyBarSeries[] = [
  { key: 'opens', label: t('statistics.opens'), color: COLORS.opens },
  { key: 'plays', label: t('statistics.plays'), color: COLORS.plays }
];
const days = computed<DailyBarDatum[]>(() => (statistics.value?.days ?? []).map((day) => ({ ...day })));
const summary = computed(() => {
  const value = statistics.value;
  if (!store.config.EnableStatistics) return t('statistics.summaryOff');
  if (!value) return '';
  return t('statistics.since', { date: formatDate(value.since), count: value.trackedItems });
});

const totals = computed(() => {
  const value = statistics.value;
  if (!value) return [];
  return [
    { label: t('statistics.impressions'), value: numberFormat.format(value.totalImpressions) },
    { label: t('statistics.opens'), value: numberFormat.format(value.totalOpens) },
    { label: t('statistics.plays'), value: numberFormat.format(value.totalPlays) },
    { label: t('statistics.clickRate'), value: clickRate(value.totalOpens + value.totalPlays, value.totalImpressions) }
  ];
});

function clickRate(clicks: number, impressions: number): string {
  if (impressions <= 0) return '–';
  return `${((clicks / impressions) * 100).toFixed(1)} %`;
}

function formatDate(value: string | null): string {
  if (!value) return '–';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : dateFormat.format(date);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    statistics.value = await requestJson<StatisticsResponse>('featured/statistics', {
      query: { limit: MAXIMUM_ROWS, days: 30 }
    });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

async function reset(): Promise<void> {
  if (!window.confirm(t('statistics.resetConfirm'))) return;
  loading.value = true;
  try {
    await requestJson('featured/statistics/reset', { method: 'POST' });
  } finally {
    loading.value = false;
  }
  await load();
}

// The tab is kept in the page; load when it is first shown and reload on every later visit.
watch(
  () => store.activeTab.value,
  (tab) => {
    if (tab === 'statistics') void load();
  },
  { immediate: true }
);
</script>

<template>
  <section
    id="featuredPanel-statistics"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-statistics"
  >
    <ConfigListHeader :title="t('statistics.title')" :help-text="t('statistics.help')" :summary="summary">
      <template #actions>
        <label class="featured-statisticsToggle">
          <span>{{ t('statistics.enabledShort') }}</span>
          <ConfigSwitch v-model="store.config.EnableStatistics" :label="t('statistics.enabled')" hide-label />
        </label>
        <button type="button" class="featured-textButton" :disabled="loading" @click="load">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('statistics.refresh') }}
        </button>
        <button
          type="button"
          class="featured-textButton"
          :disabled="loading || !statistics?.trackedItems"
          @click="reset"
        >
          <span class="material-icons" aria-hidden="true">delete_sweep</span>
          {{ t('statistics.reset') }}
        </button>
      </template>
    </ConfigListHeader>

    <p v-if="error" class="featured-statisticsNote" role="alert">{{ t('statistics.loadFailed', { error }) }}</p>
    <p v-else-if="!statistics" class="featured-statisticsNote">{{ t('statistics.loading') }}</p>
    <template v-else>
      <dl class="featured-statisticsTotals" aria-live="polite">
        <div v-for="total in totals" :key="total.label">
          <dt>{{ total.label }}</dt>
          <dd>{{ total.value }}</dd>
        </div>
      </dl>

      <ConfigCard :title="t('statistics.historyTitle')">
        <div class="featured-statisticsCharts">
          <DailyBarChart :title="t('statistics.impressionsPerDay')" :days="days" :series="impressionSeries" />
          <DailyBarChart :title="t('statistics.interactionsPerDay')" :days="days" :series="interactionSeries" />
        </div>
      </ConfigCard>

      <ConfigCard v-if="!statistics.items.length" :title="t('statistics.topTitle')">
        <p class="featured-statisticsNote">{{ t('statistics.empty') }}</p>
      </ConfigCard>
      <ConfigCard v-else>
        <StatisticsTable :title="t('statistics.topTitle')" :rows="statistics.items" :bar-color="COLORS.impressions" />
      </ConfigCard>
    </template>
  </section>
</template>

<style scoped>
.featured-statisticsToggle {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
}
.featured-statisticsToggle > span {
  font-size: 0.9rem;
  opacity: 0.75;
}
.featured-statisticsNote {
  color: var(--featured-theme-text-secondary);
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}
.featured-statisticsTotals {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 0 1rem;
}
.featured-statisticsTotals div {
  background: var(--featured-theme-paper);
  border-radius: var(--featured-theme-radius);
  padding: 0.75rem 1rem;
}
.featured-statisticsTotals dt {
  color: var(--featured-theme-text-secondary);
  font-size: 0.75rem;
}
.featured-statisticsTotals dd {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  margin: 0.15rem 0 0;
}
.featured-statisticsCharts {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 1000px) {
  .featured-statisticsCharts {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .featured-statisticsTotals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
