<script setup lang="ts">
withDefaults(defineProps<{ columns?: 2 | 3 | 4 }>(), { columns: 2 });
</script>

<template>
  <div class="featured-configGrid" :class="`featured-configGrid-${columns}`">
    <slot />
  </div>
</template>

<style scoped>
.featured-configGrid {
  align-items: end;
  display: grid;
  gap: 0.75rem 1rem;
}
.featured-configGrid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.featured-configGrid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.featured-configGrid-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.featured-configGrid > :deep(.featured-multiPicker),
.featured-configGrid > :deep(.inputContainer),
.featured-configGrid > :deep(.selectContainer),
.featured-configGrid > :deep(.checkboxContainer) {
  margin-bottom: 0;
}

@media (max-width: 900px) {
  .featured-configGrid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .featured-configGrid-2,
  .featured-configGrid-3,
  .featured-configGrid-4 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
