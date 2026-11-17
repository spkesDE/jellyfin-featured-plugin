<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ConfigCard from './ConfigCard.vue';
import ConfigSwitch from './ConfigSwitch.vue';
import { t } from '../../i18n';
import { requestJson } from '../../core/apiClient';
import { useConfigStore } from '../libs/store';

interface StatisticsRow {
  id: string;
  name: string | null;
  type: string | null;
  impressions: number;
  opens: number;
  plays: number;
  lastShownAt: string | null;
}

interface StatisticsResponse {
  enabled: boolean;
  since: string;
  trackedItems: number;
  totalImpressions: number;
  totalOpens: number;
  totalPlays: number;
  items: StatisticsRow[];
}

const store = useConfigStore();
const statistics = ref<StatisticsResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

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
    statistics.value = await requestJson<StatisticsResponse>('featured/statistics', { query: { limit: 100 } });
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

onMounted(() => void load());
</script>

<template>
  <ConfigCard class="featured-statisticsCard" :title="t('statistics.title')" :help="t('statistics.help')">
    <template #actions>
      <div class="featured-statisticsActions">
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
      </div>
    </template>

    <p v-if="error" class="featured-statisticsNote" role="alert">
      {{ t('statistics.loadFailed', { error }) }}
    </p>
    <template v-else-if="statistics">
      <dl class="featured-statisticsTotals" aria-live="polite">
        <div v-for="total in totals" :key="total.label">
          <dt>{{ total.label }}</dt>
          <dd>{{ total.value }}</dd>
        </div>
      </dl>
      <p class="featured-statisticsNote">
        {{ t('statistics.since', { date: formatDate(statistics.since), count: statistics.trackedItems }) }}
      </p>
      <div v-if="statistics.items.length" class="featured-statisticsScroll">
        <table>
          <thead>
            <tr>
              <th>{{ t('statistics.titleColumn') }}</th>
              <th>{{ t('statistics.impressions') }}</th>
              <th>{{ t('statistics.opens') }}</th>
              <th>{{ t('statistics.plays') }}</th>
              <th>{{ t('statistics.clickRate') }}</th>
              <th>{{ t('statistics.lastShown') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in statistics.items" :key="row.id">
              <td :class="{ 'is-removed': !row.name }">{{ row.name ?? t('statistics.removedTitle') }}</td>
              <td>{{ numberFormat.format(row.impressions) }}</td>
              <td>{{ numberFormat.format(row.opens) }}</td>
              <td>{{ numberFormat.format(row.plays) }}</td>
              <td>{{ clickRate(row.opens + row.plays, row.impressions) }}</td>
              <td>{{ formatDate(row.lastShownAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="featured-statisticsNote">{{ t('statistics.empty') }}</p>
    </template>
    <p v-else class="featured-statisticsNote">{{ t('statistics.loading') }}</p>
  </ConfigCard>
</template>

<style scoped>
.featured-statisticsCard {
  margin-top: 1rem;
}
.featured-statisticsActions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  justify-content: flex-end;
}
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
.featured-statisticsTotals {
  display: grid;
  gap: 0.6rem 1.5rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 0 0.5rem;
}
.featured-statisticsTotals div {
  border-bottom: 1px solid var(--featured-theme-divider);
  padding-bottom: 0.5rem;
}
.featured-statisticsTotals dt {
  color: var(--featured-theme-text-secondary);
  font-size: 0.75rem;
}
.featured-statisticsTotals dd {
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
  margin: 0;
}
.featured-statisticsNote {
  color: var(--featured-theme-text-secondary);
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}
.featured-statisticsScroll {
  overflow-x: auto;
}
.featured-statisticsScroll table {
  border-collapse: collapse;
  min-width: 36rem;
  width: 100%;
}
.featured-statisticsScroll th,
.featured-statisticsScroll td {
  border-bottom: 1px solid var(--featured-theme-divider);
  padding: 0.5rem 0.65rem;
  text-align: left;
}
.featured-statisticsScroll th:not(:first-child),
.featured-statisticsScroll td:not(:first-child) {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.featured-statisticsScroll th {
  color: var(--featured-theme-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}
.featured-statisticsScroll td.is-removed {
  font-style: italic;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .featured-statisticsTotals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .featured-statisticsActions {
    justify-content: space-between;
  }
}
</style>
