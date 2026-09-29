<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import { getHeroFadePoints } from '../../slider/layout';
import type { HeroFadeCurve, HeroFadePoint } from '../../types/config';

const props = defineProps<{
  curve: HeroFadeCurve;
  points: HeroFadePoint[];
  strength: number;
  start: number;
  end: number;
}>();
const emit = defineEmits<{
  'update:curve': [value: HeroFadeCurve];
  'update:points': [value: HeroFadePoint[]];
  'update:strength': [value: number];
  'update:start': [value: number];
  'update:end': [value: number];
}>();

const width = 640;
const height = 180;
const inset = { left: 40, right: 14, top: 10, bottom: 28 };
const selectedIndex = ref(1);
const dragging = ref<
  { kind: 'point'; index: number } | { kind: 'start' } | { kind: 'end' } | { kind: 'endPoint' } | null
>(null);
const graph = ref<SVGSVGElement | null>(null);
const basePoints = computed(() => getHeroFadePoints(props.curve, props.points));
const effectiveStrength = computed(() => Math.max(0, Math.min(100, props.strength)) / 100);
const selectedPoint = computed(() => basePoints.value[selectedIndex.value] ?? basePoints.value[1]);
const canRemove = computed(
  () => selectedIndex.value > 0 && selectedIndex.value < basePoints.value.length - 1 && basePoints.value.length > 4
);

const x = (position: number): number => inset.left + (position / 100) * (width - inset.left - inset.right);
const yEffective = (fade: number): number => height - inset.bottom - (fade / 100) * (height - inset.top - inset.bottom);
const y = (fade: number): number => yEffective(fade * effectiveStrength.value);
const actualPosition = (point: HeroFadePoint): number =>
  props.start + ((props.end - props.start) * point.Position) / 100;
const relativePosition = (position: number): number =>
  ((position - props.start) / Math.max(1, props.end - props.start)) * 100;
const selectedActualPosition = computed(() => Math.round(actualPosition(selectedPoint.value)));
const graphPoints = computed(() =>
  basePoints.value.map((point) => ({
    ...point,
    ActualPosition: actualPosition(point),
    EffectiveFade: point.Fade * effectiveStrength.value
  }))
);
const path = computed(() =>
  graphPoints.value.map((point, index) => `${index ? 'L' : 'M'} ${x(point.ActualPosition)} ${y(point.Fade)}`).join(' ')
);
const areaPath = computed(() => `${path.value} L ${x(props.end)} ${y(0)} L ${x(props.start)} ${y(0)} Z`);
const gridValues = [0, 25, 50, 75, 100];

watch(basePoints, (points) => {
  selectedIndex.value = Math.max(1, Math.min(selectedIndex.value, points.length - 2));
});

function commitCustom(points: HeroFadePoint[]): void {
  emit('update:curve', 'custom');
  emit(
    'update:points',
    points.map((point) => ({ ...point }))
  );
}

function updateSelected(position: number, fade: number): void {
  const points = basePoints.value.map((point) => ({ ...point }));
  const index = selectedIndex.value;
  if (index <= 0 || index >= points.length - 1) return;
  const previous = points[index - 1].Position;
  const next = points[index + 1].Position;
  points[index] = {
    Position: Math.round(Math.max(previous + 1, Math.min(next - 1, position))),
    Fade: Math.round(Math.max(0, Math.min(100, fade)))
  };
  commitCustom(points);
}

function updatePosition(value: unknown): void {
  updateSelected(relativePosition(Number(value)), selectedPoint.value.Fade);
}

function updateFade(value: unknown): void {
  updateSelected(selectedPoint.value.Position, Number(value));
}

function addPoint(): void {
  const points = basePoints.value.map((point) => ({ ...point }));
  if (points.length >= 12) return;
  let insertAt = 1;
  let largestGap = 0;
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].Position - points[index - 1].Position;
    if (gap > largestGap) {
      largestGap = gap;
      insertAt = index;
    }
  }
  if (largestGap < 2) return;
  const previous = points[insertAt - 1];
  const next = points[insertAt];
  points.splice(insertAt, 0, {
    Position: Math.round((previous.Position + next.Position) / 2),
    Fade: Math.round((previous.Fade + next.Fade) / 2)
  });
  selectedIndex.value = insertAt;
  commitCustom(points);
}

function removePoint(): void {
  if (!canRemove.value) return;
  const points = basePoints.value.map((point) => ({ ...point }));
  points.splice(selectedIndex.value, 1);
  selectedIndex.value = Math.max(1, selectedIndex.value - 1);
  commitCustom(points);
}

function pointerCoordinates(
  event: PointerEvent
): { bannerPosition: number; position: number; fade: number; effectiveFade: number } | null {
  const element = graph.value;
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const localX = ((event.clientX - rect.left) / rect.width) * width;
  const localY = ((event.clientY - rect.top) / rect.height) * height;
  const bannerPosition = ((localX - inset.left) / (width - inset.left - inset.right)) * 100;
  const relativePosition = ((bannerPosition - props.start) / Math.max(1, props.end - props.start)) * 100;
  const effectiveFade = ((height - inset.bottom - localY) / (height - inset.top - inset.bottom)) * 100;
  const fade = effectiveStrength.value > 0 ? effectiveFade / effectiveStrength.value : selectedPoint.value.Fade;
  return { bannerPosition, position: relativePosition, fade, effectiveFade };
}

function startDrag(index: number, event: PointerEvent): void {
  event.preventDefault();
  if (index === 0) dragging.value = { kind: 'start' };
  else if (index === basePoints.value.length - 1) dragging.value = { kind: 'endPoint' };
  else {
    selectedIndex.value = index;
    dragging.value = { kind: 'point', index };
  }
  graph.value?.setPointerCapture(event.pointerId);
}

function startBoundaryDrag(kind: 'start' | 'end', event: PointerEvent): void {
  event.preventDefault();
  dragging.value = { kind };
  graph.value?.setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent): void {
  if (!dragging.value) return;
  event.preventDefault();
  const coordinates = pointerCoordinates(event);
  if (!coordinates) return;
  if (dragging.value.kind === 'start') {
    emit('update:start', Math.round(Math.max(0, Math.min(props.end - 1, coordinates.bannerPosition))));
  } else if (dragging.value.kind === 'end') {
    emit('update:end', Math.round(Math.max(props.start + 1, Math.min(100, coordinates.bannerPosition))));
  } else if (dragging.value.kind === 'endPoint') {
    emit('update:end', Math.round(Math.max(props.start + 1, Math.min(100, coordinates.bannerPosition))));
    emit('update:strength', Math.round(Math.max(0, Math.min(100, coordinates.effectiveFade))));
  } else {
    selectedIndex.value = dragging.value.index;
    updateSelected(coordinates.position, coordinates.fade);
  }
}

function stopDrag(event: PointerEvent): void {
  dragging.value = null;
  if (graph.value?.hasPointerCapture(event.pointerId)) graph.value.releasePointerCapture(event.pointerId);
}
</script>

<template>
  <section class="featured-fadeEditor" :aria-label="t('display.fadeEditor')">
    <div class="featured-fadeEditorHeader featured-configSplitHeader">
      <div>
        <strong>{{ t('display.fadeEditor') }}</strong>
        <small>{{ t('display.fadeEditorHelp') }}</small>
      </div>
    </div>

    <div class="featured-fadeGraph" @selectstart.prevent @dragstart.prevent>
      <svg
        ref="graph"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="t('display.fadeGraphLabel')"
        @pointermove="drag"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
      >
        <g class="featured-fadeGrid">
          <template v-for="value in gridValues" :key="`grid-${value}`">
            <line :x1="x(0)" :x2="x(100)" :y1="yEffective(value)" :y2="yEffective(value)" />
            <text :x="inset.left - 8" :y="yEffective(value) + 4" text-anchor="end">{{ value }}</text>
            <line :x1="x(value)" :x2="x(value)" :y1="inset.top" :y2="height - inset.bottom" />
            <text :x="x(value)" :y="height - 10" text-anchor="middle">{{ value }}</text>
          </template>
        </g>
        <g
          class="featured-fadeBoundaryTarget"
          role="button"
          tabindex="0"
          :aria-label="t('display.fadeStart')"
          @pointerdown="startBoundaryDrag('start', $event)"
        >
          <line
            class="featured-fadeBoundaryHit"
            :x1="x(start)"
            :x2="x(start)"
            :y1="inset.top"
            :y2="height - inset.bottom"
          />
          <line
            class="featured-fadeBoundary"
            :x1="x(start)"
            :x2="x(start)"
            :y1="inset.top"
            :y2="height - inset.bottom"
          />
        </g>
        <g
          class="featured-fadeBoundaryTarget"
          role="button"
          tabindex="0"
          :aria-label="t('display.fadeEnd')"
          @pointerdown="startBoundaryDrag('end', $event)"
        >
          <line
            class="featured-fadeBoundaryHit"
            :x1="x(end)"
            :x2="x(end)"
            :y1="inset.top"
            :y2="height - inset.bottom"
          />
          <line class="featured-fadeBoundary" :x1="x(end)" :x2="x(end)" :y1="inset.top" :y2="height - inset.bottom" />
        </g>
        <path class="featured-fadeArea" :d="areaPath" />
        <path class="featured-fadeLine" :d="path" />
        <g
          v-for="(point, index) in graphPoints"
          :key="`${index}-${point.Position}`"
          class="featured-fadePointTarget"
          role="button"
          tabindex="0"
          :aria-label="
            t('display.fadePointLabel', {
              position: Math.round(point.ActualPosition),
              fade: Math.round(point.EffectiveFade)
            })
          "
          @pointerdown="startDrag(index, $event)"
          @keydown.enter.prevent="selectedIndex = index"
          @keydown.space.prevent="selectedIndex = index"
        >
          <circle class="featured-fadePointHit" :cx="x(point.ActualPosition)" :cy="y(point.Fade)" r="14" />
          <circle
            class="featured-fadePoint"
            :class="{ 'is-selected': index === selectedIndex }"
            :cx="x(point.ActualPosition)"
            :cy="y(point.Fade)"
            r="4.5"
          />
        </g>
      </svg>
      <div class="featured-fadeAxisLabels" aria-hidden="true">
        <span>{{ t('display.fadeAmount') }} (%)</span>
        <span>{{ t('display.fadePosition') }} (%)</span>
      </div>
    </div>

    <div class="featured-fadePointControls">
      <label class="inputContainer">
        <span class="inputLabel">{{ t('display.fadePointPosition') }} (%)</span>
        <input
          class="emby-input"
          type="number"
          :min="start + 1"
          :max="end - 1"
          step="1"
          :disabled="selectedIndex <= 0 || selectedIndex >= basePoints.length - 1"
          :value="selectedActualPosition"
          @input="updatePosition(($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="inputContainer">
        <span class="inputLabel">{{ t('display.fadePointAmount') }} (%)</span>
        <input
          class="emby-input"
          type="number"
          min="0"
          max="100"
          step="1"
          :disabled="selectedIndex <= 0 || selectedIndex >= basePoints.length - 1"
          :value="selectedPoint.Fade"
          @input="updateFade(($event.target as HTMLInputElement).value)"
        />
      </label>
      <button
        type="button"
        class="raised emby-button featured-fadePointAction"
        :aria-label="t('display.fadeAddPoint')"
        :title="t('display.fadeAddPoint')"
        :disabled="basePoints.length >= 12"
        @click="addPoint"
      >
        +
      </button>
      <button
        type="button"
        class="raised emby-button featured-fadePointAction"
        :aria-label="t('display.fadeRemovePoint')"
        :title="t('display.fadeRemovePoint')"
        :disabled="!canRemove"
        @click="removePoint"
      >
        −
      </button>
    </div>
  </section>
</template>

<style scoped>
.featured-fadeEditor {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  display: grid;
  gap: 0.7rem;
  margin-bottom: 1rem;
  padding: 0.85rem;
}
.featured-fadeEditorHeader > div {
  display: grid;
  gap: 0.2rem;
}
.featured-fadeEditorHeader strong {
  font-weight: 500;
}
.featured-fadeEditorHeader small {
  color: var(--featured-theme-text-secondary);
  line-height: 1.35;
}
.featured-fadeGraph {
  min-width: 0;
  position: relative;
}
.featured-fadeGraph,
.featured-fadeGraph * {
  -webkit-user-select: none;
  user-select: none;
}
.featured-fadeGraph svg {
  display: block;
  touch-action: none;
  width: 100%;
}
.featured-fadeGrid {
  pointer-events: none;
}
.featured-fadeGrid line {
  stroke: var(--featured-theme-divider);
  stroke-width: 1;
}
.featured-fadeGrid text {
  fill: var(--featured-theme-text-secondary);
  font-size: 10px;
}
.featured-fadeBoundaryTarget {
  cursor: ew-resize;
}
.featured-fadeBoundaryHit {
  stroke: transparent;
  stroke-width: 18;
}
.featured-fadeBoundary {
  stroke: var(--featured-theme-text-secondary);
  stroke-dasharray: 4 4;
  stroke-width: 1;
}
.featured-fadeArea {
  fill: rgba(0, 164, 220, 0.16);
  fill: color-mix(in srgb, var(--featured-theme-primary) 18%, transparent);
  pointer-events: none;
}
.featured-fadeLine {
  fill: none;
  pointer-events: none;
  stroke: var(--featured-theme-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.25;
}
.featured-fadePointTarget {
  cursor: grab;
}
.featured-fadePointTarget:active {
  cursor: grabbing;
}
.featured-fadePointHit {
  fill: transparent;
}
.featured-fadePoint {
  fill: var(--featured-theme-paper);
  stroke: var(--featured-theme-primary);
  stroke-width: 2.25;
}
.featured-fadePoint.is-selected {
  fill: var(--featured-theme-primary);
}
.featured-fadeAxisLabels {
  color: var(--featured-theme-text-secondary);
  display: flex;
  font-size: 0.72rem;
  justify-content: space-between;
  padding: 0 0.25rem 0 2.65rem;
}
.featured-fadePointControls {
  align-items: end;
  display: grid;
  gap: 0.7rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
}
.featured-fadePointControls .inputContainer {
  margin-bottom: 0;
}
.featured-fadePointAction {
  align-items: center;
  display: inline-flex;
  font-size: 1.35rem;
  height: 2.5rem;
  justify-content: center;
  margin: 0;
  min-width: 2.5rem;
  padding: 0;
  text-transform: none;
  width: 2.5rem;
}
@media (max-width: 650px) {
  .featured-fadePointControls {
    gap: 0.45rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
  }
}
</style>
