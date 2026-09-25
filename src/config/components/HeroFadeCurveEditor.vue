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
  { kind: 'point'; index: number }
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'endPoint' }
  | null
>(null);
const graph = ref<SVGSVGElement | null>(null);
const basePoints = computed(() => getHeroFadePoints(props.curve, props.points));
const effectiveStrength = computed(() => Math.max(0, Math.min(100, props.strength)) / 100);
const selectedPoint = computed(() => basePoints.value[selectedIndex.value] ?? basePoints.value[1]);
const canRemove = computed(() => selectedIndex.value > 0
  && selectedIndex.value < basePoints.value.length - 1
  && basePoints.value.length > 4);

const x = (position: number): number => inset.left + (position / 100) * (width - inset.left - inset.right);
const yEffective = (fade: number): number => height - inset.bottom
  - (fade / 100) * (height - inset.top - inset.bottom);
const y = (fade: number): number => yEffective(fade * effectiveStrength.value);
const actualPosition = (point: HeroFadePoint): number => props.start
  + ((props.end - props.start) * point.Position / 100);
const relativePosition = (position: number): number => ((position - props.start)
  / Math.max(1, props.end - props.start)) * 100;
const selectedActualPosition = computed(() => Math.round(actualPosition(selectedPoint.value)));
const graphPoints = computed(() => basePoints.value.map((point) => ({
  ...point,
  ActualPosition: actualPosition(point),
  EffectiveFade: point.Fade * effectiveStrength.value
})));
const path = computed(() => graphPoints.value
  .map((point, index) => `${index ? 'L' : 'M'} ${x(point.ActualPosition)} ${y(point.Fade)}`)
  .join(' '));
const areaPath = computed(() => `${path.value} L ${x(props.end)} ${y(0)} L ${x(props.start)} ${y(0)} Z`);
const gridValues = [0, 25, 50, 75, 100];

watch(basePoints, (points) => {
  selectedIndex.value = Math.max(1, Math.min(selectedIndex.value, points.length - 2));
});

function commitCustom(points: HeroFadePoint[]): void {
  emit('update:curve', 'custom');
  emit('update:points', points.map((point) => ({ ...point })));
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

function pointerCoordinates(event: PointerEvent): { bannerPosition: number; position: number; fade: number; effectiveFade: number } | null {
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
  <section class="ec-fadeEditor" :aria-label="t('display.fadeEditor')">
    <div class="ec-fadeEditorHeader">
      <div>
        <strong>{{ t('display.fadeEditor') }}</strong>
        <small>{{ t('display.fadeEditorHelp') }}</small>
      </div>
    </div>

    <div class="ec-fadeGraph" @selectstart.prevent @dragstart.prevent>
      <svg
        ref="graph"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="t('display.fadeGraphLabel')"
        @pointermove="drag"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
      >
        <g class="ec-fadeGrid">
          <template v-for="value in gridValues" :key="`grid-${value}`">
            <line :x1="x(0)" :x2="x(100)" :y1="yEffective(value)" :y2="yEffective(value)" />
            <text :x="inset.left - 8" :y="yEffective(value) + 4" text-anchor="end">{{ value }}</text>
            <line :x1="x(value)" :x2="x(value)" :y1="inset.top" :y2="height - inset.bottom" />
            <text :x="x(value)" :y="height - 10" text-anchor="middle">{{ value }}</text>
          </template>
        </g>
        <g class="ec-fadeBoundaryTarget" role="button" tabindex="0" :aria-label="t('display.fadeStart')" @pointerdown="startBoundaryDrag('start', $event)">
          <line class="ec-fadeBoundaryHit" :x1="x(start)" :x2="x(start)" :y1="inset.top" :y2="height - inset.bottom" />
          <line class="ec-fadeBoundary" :x1="x(start)" :x2="x(start)" :y1="inset.top" :y2="height - inset.bottom" />
        </g>
        <g class="ec-fadeBoundaryTarget" role="button" tabindex="0" :aria-label="t('display.fadeEnd')" @pointerdown="startBoundaryDrag('end', $event)">
          <line class="ec-fadeBoundaryHit" :x1="x(end)" :x2="x(end)" :y1="inset.top" :y2="height - inset.bottom" />
          <line class="ec-fadeBoundary" :x1="x(end)" :x2="x(end)" :y1="inset.top" :y2="height - inset.bottom" />
        </g>
        <path class="ec-fadeArea" :d="areaPath" />
        <path class="ec-fadeLine" :d="path" />
        <g
          v-for="(point, index) in graphPoints"
          :key="`${index}-${point.Position}`"
          class="ec-fadePointTarget"
          role="button"
          tabindex="0"
          :aria-label="t('display.fadePointLabel', { position: Math.round(point.ActualPosition), fade: Math.round(point.EffectiveFade) })"
          @pointerdown="startDrag(index, $event)"
          @keydown.enter.prevent="selectedIndex = index"
          @keydown.space.prevent="selectedIndex = index"
        >
          <circle class="ec-fadePointHit" :cx="x(point.ActualPosition)" :cy="y(point.Fade)" r="14" />
          <circle class="ec-fadePoint" :class="{ 'is-selected': index === selectedIndex }" :cx="x(point.ActualPosition)" :cy="y(point.Fade)" r="4.5" />
        </g>
      </svg>
      <div class="ec-fadeAxisLabels" aria-hidden="true">
        <span>{{ t('display.fadeAmount') }} (%)</span>
        <span>{{ t('display.fadePosition') }} (%)</span>
      </div>
    </div>

    <div class="ec-fadePointControls">
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
        >
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
        >
      </label>
      <button
        type="button"
        class="raised emby-button ec-fadePointAction"
        :aria-label="t('display.fadeAddPoint')"
        :title="t('display.fadeAddPoint')"
        :disabled="basePoints.length >= 12"
        @click="addPoint"
      >+</button>
      <button
        type="button"
        class="raised emby-button ec-fadePointAction"
        :aria-label="t('display.fadeRemovePoint')"
        :title="t('display.fadeRemovePoint')"
        :disabled="!canRemove"
        @click="removePoint"
      >−</button>
    </div>
  </section>
</template>

<style scoped>
.ec-fadeEditor {
  background: var(--ec-theme-paper);
  border: 1px solid var(--ec-theme-divider);
  border-radius: var(--ec-theme-radius);
  display: grid;
  gap: .7rem;
  margin-bottom: 1rem;
  padding: .85rem;
}
.ec-fadeEditorHeader { align-items: flex-start; display: flex; gap: 1rem; justify-content: space-between; }
.ec-fadeEditorHeader>div { display: grid; gap: .2rem; }
.ec-fadeEditorHeader strong { font-weight: 500; }
.ec-fadeEditorHeader small { color: var(--ec-theme-text-secondary); line-height: 1.35; }
.ec-fadeGraph { min-width: 0; position: relative; }
.ec-fadeGraph, .ec-fadeGraph * { -webkit-user-select: none; user-select: none; }
.ec-fadeGraph svg { display: block; touch-action: none; width: 100%; }
.ec-fadeGrid { pointer-events: none; }
.ec-fadeGrid line { stroke: var(--ec-theme-divider); stroke-width: 1; }
.ec-fadeGrid text { fill: var(--ec-theme-text-secondary); font-size: 10px; }
.ec-fadeBoundaryTarget { cursor: ew-resize; }
.ec-fadeBoundaryHit { stroke: transparent; stroke-width: 18; }
.ec-fadeBoundary { stroke: var(--ec-theme-text-secondary); stroke-dasharray: 4 4; stroke-width: 1; }
.ec-fadeArea { fill: rgba(0, 164, 220, .16); fill: color-mix(in srgb, var(--ec-theme-primary) 18%, transparent); pointer-events: none; }
.ec-fadeLine { fill: none; pointer-events: none; stroke: var(--ec-theme-primary); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.25; }
.ec-fadePointTarget { cursor: grab; }
.ec-fadePointTarget:active { cursor: grabbing; }
.ec-fadePointHit { fill: transparent; }
.ec-fadePoint { fill: var(--ec-theme-paper); stroke: var(--ec-theme-primary); stroke-width: 2.25; }
.ec-fadePoint.is-selected { fill: var(--ec-theme-primary); }
.ec-fadeAxisLabels { color: var(--ec-theme-text-secondary); display: flex; font-size: .72rem; justify-content: space-between; padding: 0 .25rem 0 2.65rem; }
.ec-fadePointControls { align-items: end; display: grid; gap: .7rem; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; }
.ec-fadePointControls .inputContainer { margin-bottom: 0; }
.ec-fadePointAction { align-items: center; display: inline-flex; font-size: 1.35rem; height: 2.5rem; justify-content: center; margin: 0; min-width: 2.5rem; padding: 0; text-transform: none; width: 2.5rem; }
@media (max-width: 650px) {
  .ec-fadePointControls { gap: .45rem; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; }
}
</style>
