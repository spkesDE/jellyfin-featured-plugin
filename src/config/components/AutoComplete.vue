<script lang="ts">
export interface AutoCompleteOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    inputId: string;
    label?: string;
    placeholder?: string;
    options: AutoCompleteOption[];
    loading?: boolean;
    error?: string;
    searched?: boolean;
    loadingText?: string;
    noResultsText?: string;
    minQueryLength?: number;
    debounceMs?: number;
  }>(),
  {
    label: '',
    placeholder: '',
    loading: false,
    error: '',
    searched: false,
    loadingText: 'Loading…',
    noResultsText: 'No results.',
    minQueryLength: 2,
    debounceMs: 250
  }
);

const emit = defineEmits<{
  search: [query: string];
  'query-change': [query: string];
  select: [option: AutoCompleteOption];
}>();

const query = defineModel<string>({ default: '' });
const open = ref(false);
const activeOption = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const showResults = computed(
  () =>
    open.value &&
    query.value.trim().length >= props.minQueryLength &&
    Boolean(props.loading || props.searched || props.error || props.options.length)
);

function clearSearchTimer(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = undefined;
}

function handleInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  const searchTerm = query.value.trim();
  clearSearchTimer();
  open.value = true;
  activeOption.value = 0;
  emit('query-change', searchTerm);
  if (searchTerm.length < props.minQueryLength) return;

  searchTimer = setTimeout(() => {
    searchTimer = undefined;
    emit('search', searchTerm);
  }, props.debounceMs);
}

function select(option: AutoCompleteOption): void {
  emit('select', option);
  activeOption.value = 0;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false;
    return;
  }
  if (event.key === 'ArrowDown' && props.options.length) {
    event.preventDefault();
    open.value = true;
    activeOption.value = (activeOption.value + 1) % props.options.length;
    return;
  }
  if (event.key === 'ArrowUp' && props.options.length) {
    event.preventDefault();
    open.value = true;
    activeOption.value = (activeOption.value - 1 + props.options.length) % props.options.length;
    return;
  }
  if (event.key === 'Enter' && open.value && props.options.length) {
    event.preventDefault();
    select(props.options[activeOption.value]);
  }
}

watch(
  () => props.options.length,
  (length) => {
    if (!length || activeOption.value >= length) activeOption.value = 0;
  }
);

onBeforeUnmount(clearSearchTimer);
</script>

<template>
  <div class="featured-autocompleteField">
    <label v-if="label" class="inputLabel" :for="inputId">{{ label }}</label>
    <div class="featured-autocompleteInputWrap">
      <input
        :id="inputId"
        :value="query"
        class="emby-input"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-expanded="showResults"
        :aria-controls="`${inputId}-results`"
        :aria-activedescendant="showResults && options.length ? `${inputId}-result-${activeOption}` : undefined"
        :aria-busy="loading"
        @input="handleInput"
        @focus="open = true"
        @blur="open = false"
        @keydown="handleKeydown"
      />
      <span class="material-icons featured-autocompleteIcon" :class="{ 'is-loading': loading }" aria-hidden="true">
        {{ loading ? 'sync' : 'search' }}
      </span>
    </div>

    <div v-if="showResults" :id="`${inputId}-results`" class="featured-autocompleteResults" role="listbox">
      <p v-if="loading" class="featured-autocompleteStatus">{{ loadingText }}</p>
      <p v-else-if="error" class="featured-autocompleteStatus is-error">{{ error }}</p>
      <button
        v-for="(option, optionIndex) in options"
        v-else
        :id="`${inputId}-result-${optionIndex}`"
        :key="option.value"
        type="button"
        class="featured-autocompleteOption"
        :class="{ 'is-active': optionIndex === activeOption }"
        role="option"
        :aria-selected="optionIndex === activeOption"
        @mousedown.prevent
        @mouseenter="activeOption = optionIndex"
        @click="select(option)"
      >
        <slot name="option" :option="option">
          <span class="featured-autocompleteOptionMain">
            <strong>{{ option.label }}</strong>
            <small v-if="option.description">{{ option.description }}</small>
          </span>
          <span v-if="option.icon" class="material-icons" aria-hidden="true">{{ option.icon }}</span>
        </slot>
      </button>
      <p v-if="!loading && !error && searched && !options.length" class="featured-autocompleteStatus">
        {{ noResultsText }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.featured-autocompleteField {
  position: relative;
}
.featured-autocompleteInputWrap {
  position: relative;
}
.featured-autocompleteInputWrap .emby-input {
  background: var(--jf-palette-FilledInput-bg, var(--featured-theme-action-hover));
  border: 1px solid var(--jf-palette-FilledInput-borderColor, var(--featured-theme-divider));
  border-radius: var(--featured-theme-radius);
  box-sizing: border-box;
  color: inherit;
  padding: 0.6rem 2.6rem 0.6rem 0.75rem;
  width: 100%;
}
.featured-autocompleteIcon {
  opacity: 0.58;
  pointer-events: none;
  position: absolute;
  right: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
}
.featured-autocompleteIcon.is-loading {
  animation: featured-autocompleteSpin 0.8s linear infinite;
}
@keyframes featured-autocompleteSpin {
  to {
    transform: translateY(-50%) rotate(360deg);
  }
}
.featured-autocompleteResults {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  box-shadow: 0 0.85rem 2.4rem rgba(0, 0, 0, 0.4);
  color: var(--featured-theme-text-primary);
  display: grid;
  left: 0;
  margin-top: 0.35rem;
  max-height: 18rem;
  overflow-y: auto;
  padding: 0.3rem;
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 100;
}
.featured-autocompleteOption {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 0.3rem;
  color: inherit;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.7rem;
  text-align: left;
}
.featured-autocompleteOption:hover,
.featured-autocompleteOption.is-active {
  background: var(--featured-theme-action-hover);
}
.featured-autocompleteOptionMain {
  display: grid;
  gap: 0.12rem;
}
.featured-autocompleteOptionMain small {
  opacity: 0.65;
}
.featured-autocompleteStatus {
  margin: 0;
  opacity: 0.7;
  padding: 0.7rem;
}
.featured-autocompleteStatus.is-error {
  color: var(--featured-theme-error-light);
  font-size: 0.84rem;
}
</style>
