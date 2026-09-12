<script setup lang="ts">
import { computed, ref } from 'vue';
import { requestJson } from '../../core/apiClient';
import { t } from '../../i18n';
import { mediaTypeLabel } from '../../mediaTypes';
import type { FeaturedSearchItem } from '../../types/featured';
import AutoComplete, { type AutoCompleteOption } from './AutoComplete.vue';

const props = defineProps<{
  excludeIds: string[];
  inputId: string;
}>();

const emit = defineEmits<{
  select: [item: FeaturedSearchItem];
}>();

const results = ref<FeaturedSearchItem[]>([]);
const loading = ref(false);
const error = ref('');
const searched = ref(false);
let requestVersion = 0;

const options = computed<AutoCompleteOption[]>(() => results.value.map((item) => ({
  value: item.id,
  label: item.name,
  description: `${mediaTypeLabel(item.mediaType)}${item.productionYear ? ` · ${item.productionYear}` : ''}`,
  icon: 'add_circle_outline'
})));

function handleQueryChange(searchTerm: string): void {
  requestVersion += 1;
  results.value = [];
  loading.value = false;
  error.value = '';
  searched.value = false;
  if (searchTerm.length < 2) return;
}

async function search(searchTerm: string): Promise<void> {
  const version = requestVersion;
  loading.value = true;
  error.value = '';
  try {
    const response = await requestJson<{ items: FeaturedSearchItem[] }>(
      `featured/config/search?term=${encodeURIComponent(searchTerm)}`
    );
    if (requestVersion !== version) return;
    const excluded = new Set(props.excludeIds);
    results.value = (response.items ?? []).filter((item) => !excluded.has(item.id));
  } catch (reason) {
    if (requestVersion !== version) return;
    results.value = [];
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (requestVersion === version) {
      loading.value = false;
      searched.value = true;
    }
  }
}

function select(option: AutoCompleteOption): void {
  const item = results.value.find((candidate) => candidate.id === option.value);
  if (!item) return;
  emit('select', item);
  results.value = results.value.filter((candidate) => candidate.id !== item.id);
}
</script>

<template>
  <AutoComplete :input-id="inputId" :label="t('manual.searchLabel')" :placeholder="t('manual.searchPlaceholder')"
    :options="options" :loading="loading" :error="error" :searched="searched"
    :loading-text="t('manual.searching')" :no-results-text="t('manual.noResults')"
    @query-change="handleQueryChange" @search="search" @select="select" />
</template>
