<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';

export interface StatisticsRow {
  id: string;
  name: string | null;
  type: string | null;
  impressions: number;
  opens: number;
  plays: number;
  lastShownAt: string | null;
}

type SortKey = 'name' | 'impressions' | 'opens' | 'plays' | 'clickRate' | 'lastShownAt';
type SortDirection = 'asc' | 'desc';

/** Sortable, searchable and paged table of banner statistics per title. */
const props = defineProps<{ rows: StatisticsRow[]; barColor: string }>();

const PAGE_SIZES = [10, 25, 50, 100];
const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const query = ref('');
const sortKey = ref<SortKey>('impressions');
const sortDirection = ref<SortDirection>('desc');
const pageSize = ref(25);
const page = ref(0);

const columns: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: 'name', label: t('statistics.titleColumn'), numeric: false },
  { key: 'impressions', label: t('statistics.impressions'), numeric: true },
  { key: 'opens', label: t('statistics.opens'), numeric: true },
  { key: 'plays', label: t('statistics.plays'), numeric: true },
  { key: 'clickRate', label: t('statistics.clickRate'), numeric: true },
  { key: 'lastShownAt', label: t('statistics.lastShown'), numeric: true }
];

const rate = (row: StatisticsRow): number => (row.impressions > 0 ? (row.opens + row.plays) / row.impressions : -1);
const displayName = (row: StatisticsRow): string => row.name ?? t('statistics.removedTitle');

const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  return needle ? props.rows.filter((row) => displayName(row).toLocaleLowerCase().includes(needle)) : props.rows;
});

const sorted = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1;
  const compare = (a: StatisticsRow, b: StatisticsRow): number => {
    switch (sortKey.value) {
      case 'name':
        return collator.compare(displayName(a), displayName(b));
      case 'clickRate':
        return rate(a) - rate(b);
      case 'lastShownAt':
        return (Date.parse(a.lastShownAt ?? '') || 0) - (Date.parse(b.lastShownAt ?? '') || 0);
      default:
        return a[sortKey.value] - b[sortKey.value];
    }
  };
  // Ties keep a stable, readable order: most shown first, then by title.
  return [...filtered.value].sort(
    (a, b) =>
      compare(a, b) * direction || b.impressions - a.impressions || collator.compare(displayName(a), displayName(b))
  );
});

const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize.value)));
const pageRows = computed(() => sorted.value.slice(page.value * pageSize.value, (page.value + 1) * pageSize.value));
const impressionsMaximum = computed(() => Math.max(1, ...props.rows.map((row) => row.impressions)));
const pageRange = computed(() => ({
  from: sorted.value.length ? page.value * pageSize.value + 1 : 0,
  to: Math.min(sorted.value.length, (page.value + 1) * pageSize.value),
  total: sorted.value.length
}));

watch([query, pageSize, sortKey, sortDirection], () => {
  page.value = 0;
});
watch(pageCount, (count) => {
  if (page.value >= count) page.value = count - 1;
});

function sortBy(key: SortKey): void {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  sortKey.value = key;
  sortDirection.value = key === 'name' ? 'asc' : 'desc';
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDirection.value === 'asc' ? 'ascending' : 'descending';
}

function formatRate(row: StatisticsRow): string {
  const value = rate(row);
  return value < 0 ? '–' : `${(value * 100).toFixed(1)} %`;
}

function formatDate(value: string | null): string {
  if (!value) return '–';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : dateFormat.format(date);
}
</script>

<template>
  <div class="featured-dataTable">
    <div class="featured-dataTableToolbar">
      <label class="featured-dataTableSearch">
        <span class="material-icons" aria-hidden="true">search</span>
        <input
          v-model="query"
          type="search"
          :placeholder="t('statistics.search')"
          :aria-label="t('statistics.search')"
        />
      </label>
      <label class="featured-dataTablePageSize">
        <span>{{ t('statistics.rowsPerPage') }}</span>
        <select v-model.number="pageSize">
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="featured-dataTableScroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :aria-sort="ariaSort(column.key)"
              :class="{ 'is-numeric': column.numeric }"
            >
              <button type="button" class="featured-dataTableSort" @click="sortBy(column.key)">
                {{ column.label }}
                <span class="material-icons" :class="{ 'is-active': sortKey === column.key }" aria-hidden="true">
                  {{ sortKey === column.key && sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pageRows" :key="row.id">
            <td :class="{ 'is-removed': !row.name }">{{ displayName(row) }}</td>
            <td class="is-numeric featured-dataTableBarCell">
              <span
                class="featured-dataTableBar"
                :style="{ width: `${(row.impressions / impressionsMaximum) * 100}%`, background: barColor }"
                aria-hidden="true"
              ></span>
              <span class="featured-dataTableBarValue">{{ numberFormat.format(row.impressions) }}</span>
            </td>
            <td class="is-numeric">{{ numberFormat.format(row.opens) }}</td>
            <td class="is-numeric">{{ numberFormat.format(row.plays) }}</td>
            <td class="is-numeric">{{ formatRate(row) }}</td>
            <td class="is-numeric">{{ formatDate(row.lastShownAt) }}</td>
          </tr>
          <tr v-if="!pageRows.length">
            <td class="featured-dataTableEmpty" :colspan="columns.length">{{ t('statistics.noMatches') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav class="featured-dataTablePager" :aria-label="t('statistics.pagination')">
      <span aria-live="polite">{{ t('statistics.pageRange', pageRange) }}</span>
      <div class="featured-dataTablePagerButtons">
        <button
          type="button"
          class="featured-textButton"
          :disabled="page === 0"
          :aria-label="t('statistics.firstPage')"
          @click="page = 0"
        >
          <span class="material-icons" aria-hidden="true">first_page</span>
        </button>
        <button
          type="button"
          class="featured-textButton"
          :disabled="page === 0"
          :aria-label="t('statistics.previousPage')"
          @click="page -= 1"
        >
          <span class="material-icons" aria-hidden="true">chevron_left</span>
        </button>
        <span class="featured-dataTablePageNumber">{{ page + 1 }} / {{ pageCount }}</span>
        <button
          type="button"
          class="featured-textButton"
          :disabled="page >= pageCount - 1"
          :aria-label="t('statistics.nextPage')"
          @click="page += 1"
        >
          <span class="material-icons" aria-hidden="true">chevron_right</span>
        </button>
        <button
          type="button"
          class="featured-textButton"
          :disabled="page >= pageCount - 1"
          :aria-label="t('statistics.lastPage')"
          @click="page = pageCount - 1"
        >
          <span class="material-icons" aria-hidden="true">last_page</span>
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.featured-dataTableToolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.featured-dataTableSearch {
  align-items: center;
  background: var(--featured-theme-background);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  display: flex;
  flex: 1 1 16rem;
  gap: 0.4rem;
  max-width: 24rem;
  padding: 0 0.6rem;
}
.featured-dataTableSearch .material-icons {
  color: var(--featured-theme-text-secondary);
  font-size: 1.2rem;
}
.featured-dataTableSearch input {
  background: transparent;
  border: 0;
  color: inherit;
  flex: 1;
  font: inherit;
  min-width: 0;
  outline: none;
  padding: 0.5rem 0;
}
.featured-dataTablePageSize {
  align-items: center;
  color: var(--featured-theme-text-secondary);
  display: flex;
  font-size: 0.85rem;
  gap: 0.5rem;
}
.featured-dataTablePageSize select {
  background: var(--featured-theme-background);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  color: inherit;
  font: inherit;
  padding: 0.3rem 0.4rem;
}
.featured-dataTableScroll {
  overflow-x: auto;
}
.featured-dataTableScroll table {
  border-collapse: collapse;
  min-width: 40rem;
  width: 100%;
}
.featured-dataTableScroll th,
.featured-dataTableScroll td {
  border-bottom: 1px solid var(--featured-theme-divider);
  padding: 0.5rem 0.65rem;
  text-align: left;
}
.featured-dataTableScroll th {
  padding: 0;
}
.featured-dataTableScroll .is-numeric {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.featured-dataTableSort {
  align-items: center;
  background: none;
  border: 0;
  color: var(--featured-theme-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.2rem;
  padding: 0.55rem 0.65rem;
  width: 100%;
}
.is-numeric .featured-dataTableSort {
  justify-content: flex-end;
}
.featured-dataTableSort:hover,
.featured-dataTableSort:focus-visible {
  color: inherit;
}
.featured-dataTableSort .material-icons {
  font-size: 0.95rem;
  opacity: 0;
}
.featured-dataTableSort:hover .material-icons,
.featured-dataTableSort .material-icons.is-active {
  opacity: 1;
}
.featured-dataTableScroll td.is-removed {
  font-style: italic;
  opacity: 0.6;
}
.featured-dataTableBarCell {
  min-width: 9rem;
  position: relative;
}
.featured-dataTableBar {
  border-radius: 4px 0 0 4px;
  bottom: 0.45rem;
  max-width: calc(100% - 1.3rem);
  opacity: 0.35;
  position: absolute;
  right: 0.65rem;
  top: 0.45rem;
}
.featured-dataTableBarValue {
  position: relative;
}
.featured-dataTableEmpty {
  color: var(--featured-theme-text-secondary);
  text-align: center !important;
}
.featured-dataTablePager {
  align-items: center;
  color: var(--featured-theme-text-secondary);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  gap: 0.5rem 1rem;
  justify-content: space-between;
  margin-top: 0.75rem;
}
.featured-dataTablePagerButtons {
  align-items: center;
  display: flex;
  gap: 0.25rem;
}
.featured-dataTablePageNumber {
  min-width: 3.5rem;
  text-align: center;
}
</style>
