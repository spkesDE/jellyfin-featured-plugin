<script setup lang="ts">
import { computed, ref } from 'vue';

export interface DailyBarSeries {
  key: string;
  label: string;
  color: string;
}

export type DailyBarDatum = { date: string } & Record<string, number | string>;

/** Stacked daily bars on one axis, with a per-day hover tooltip and a table for screen readers. */
const props = defineProps<{
  title: string;
  days: DailyBarDatum[];
  series: DailyBarSeries[];
}>();

const WIDTH = 640;
const HEIGHT = 180;
const PLOT_TOP = 12;
const PLOT_BOTTOM = HEIGHT - 22;
const PLOT_LEFT = 36;
const PLOT_RIGHT = WIDTH - 4;
const GAP = 2;

const hovered = ref<number | null>(null);
const numberFormat = new Intl.NumberFormat();
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

const value = (day: DailyBarDatum, key: string): number => Number(day[key] ?? 0) || 0;
const total = (day: DailyBarDatum): number => props.series.reduce((sum, entry) => sum + value(day, entry.key), 0);
const maximum = computed(() => niceCeiling(Math.max(1, ...props.days.map(total))));
const slot = computed(() => (PLOT_RIGHT - PLOT_LEFT) / Math.max(1, props.days.length));
const barWidth = computed(() => Math.max(2, slot.value - GAP));
const scale = (amount: number): number => (amount / maximum.value) * (PLOT_BOTTOM - PLOT_TOP);

const bars = computed(() =>
  props.days.map((day, index) => {
    let offset = 0;
    const segments = props.series
      .map((entry) => {
        const height = scale(value(day, entry.key));
        const segment = { key: entry.key, color: entry.color, y: PLOT_BOTTOM - offset - height, height };
        offset += height;
        return segment;
      })
      .filter((segment) => segment.height > 0);
    return { x: PLOT_LEFT + index * slot.value + GAP / 2, segments };
  })
);

const xLabels = computed(() => {
  const last = props.days.length - 1;
  if (last < 0) return [];
  return [0, Math.round(last / 2), last].map((index) => ({
    x: PLOT_LEFT + index * slot.value + slot.value / 2,
    text: formatDay(props.days[index].date),
    anchor: index === 0 ? 'start' : index === last ? 'end' : 'middle'
  }));
});

const tooltip = computed(() => {
  if (hovered.value === null) return null;
  const day = props.days[hovered.value];
  if (!day) return null;
  const left = ((PLOT_LEFT + hovered.value * slot.value + slot.value / 2) / WIDTH) * 100;
  return {
    left: `${Math.min(85, Math.max(15, left))}%`,
    date: formatDay(day.date),
    rows: props.series.map((entry) => ({ ...entry, value: numberFormat.format(value(day, entry.key)) }))
  };
});

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dayFormat.format(parsed);
}

function niceCeiling(amount: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(amount));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= amount) ?? 10;
  return step * magnitude;
}

/** Rounds the top of the stack only, so the bar reads as one mark anchored to the baseline. */
function segmentPath(x: number, y: number, width: number, height: number, roundTop: boolean): string {
  const radius = roundTop ? Math.min(4, width / 2, height) : 0;
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    radius ? `Q${x},${y} ${x + radius},${y}` : '',
    `H${x + width - radius}`,
    radius ? `Q${x + width},${y} ${x + width},${y + radius}` : '',
    `V${y + height}`,
    'Z'
  ].join(' ');
}
</script>

<template>
  <figure class="featured-dailyChart">
    <figcaption class="featured-dailyChartTitle">{{ title }}</figcaption>
    <ul v-if="series.length > 1" class="featured-dailyChartLegend">
      <li v-for="entry in series" :key="entry.key">
        <span class="featured-dailyChartSwatch" :style="{ background: entry.color }" aria-hidden="true"></span>
        {{ entry.label }}
      </li>
    </ul>
    <div class="featured-dailyChartPlot" @mouseleave="hovered = null">
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" aria-hidden="true">
        <line class="featured-dailyChartGrid" :x1="PLOT_LEFT" :x2="PLOT_RIGHT" :y1="PLOT_TOP" :y2="PLOT_TOP" />
        <line class="featured-dailyChartAxis" :x1="PLOT_LEFT" :x2="PLOT_RIGHT" :y1="PLOT_BOTTOM" :y2="PLOT_BOTTOM" />
        <text class="featured-dailyChartTick" :x="PLOT_LEFT - 6" :y="PLOT_TOP + 4" text-anchor="end">
          {{ numberFormat.format(maximum) }}
        </text>
        <text class="featured-dailyChartTick" :x="PLOT_LEFT - 6" :y="PLOT_BOTTOM" text-anchor="end">0</text>
        <g
          v-for="(bar, index) in bars"
          :key="days[index].date"
          :class="{ 'is-dimmed': hovered !== null && hovered !== index }"
        >
          <path
            v-for="(segment, segmentIndex) in bar.segments"
            :key="segment.key"
            :d="
              segmentPath(
                bar.x,
                segment.y,
                barWidth,
                Math.max(0, segment.height - (segmentIndex ? GAP : 0)),
                segmentIndex === bar.segments.length - 1
              )
            "
            :fill="segment.color"
          />
          <rect
            class="featured-dailyChartHit"
            :x="PLOT_LEFT + index * slot"
            :y="0"
            :width="slot"
            :height="PLOT_BOTTOM"
            @mouseenter="hovered = index"
          />
        </g>
        <text
          v-for="label in xLabels"
          :key="label.text"
          class="featured-dailyChartTick"
          :x="label.x"
          :y="HEIGHT - 4"
          :text-anchor="label.anchor"
        >
          {{ label.text }}
        </text>
      </svg>
      <div v-if="tooltip" class="featured-dailyChartTooltip" :style="{ left: tooltip.left }" role="status">
        <strong>{{ tooltip.date }}</strong>
        <span v-for="row in tooltip.rows" :key="row.key">
          <span class="featured-dailyChartSwatch" :style="{ background: row.color }" aria-hidden="true"></span>
          {{ row.label }}: {{ row.value }}
        </span>
      </div>
    </div>
    <table class="featured-visuallyHidden">
      <caption>
        {{
          title
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th v-for="entry in series" :key="entry.key" scope="col">{{ entry.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="day in days" :key="day.date">
          <th scope="row">{{ formatDay(day.date) }}</th>
          <td v-for="entry in series" :key="entry.key">{{ value(day, entry.key) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.featured-dailyChart {
  margin: 0;
  min-width: 0;
}
.featured-dailyChartTitle {
  color: var(--featured-theme-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.featured-dailyChartLegend {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.8rem;
  gap: 0.25rem 1rem;
  list-style: none;
  margin: 0 0 0.4rem;
  padding: 0;
}
.featured-dailyChartLegend li,
.featured-dailyChartTooltip > span {
  align-items: center;
  display: inline-flex;
  gap: 0.35rem;
}
.featured-dailyChartSwatch {
  border-radius: 2px;
  display: inline-block;
  height: 0.65rem;
  width: 0.65rem;
}
.featured-dailyChartPlot {
  position: relative;
}
.featured-dailyChartPlot svg {
  display: block;
  height: auto;
  overflow: visible;
  width: 100%;
}
.featured-dailyChartGrid {
  stroke: var(--featured-theme-divider);
  stroke-dasharray: 2 4;
}
.featured-dailyChartAxis {
  stroke: var(--featured-theme-divider);
}
.featured-dailyChartTick {
  fill: var(--featured-theme-text-secondary);
  font-size: 11px;
}
.featured-dailyChartHit {
  cursor: default;
  fill: transparent;
}
g.is-dimmed path {
  opacity: 0.45;
}
.featured-dailyChartTooltip {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: 6px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 35%);
  display: grid;
  font-size: 0.8rem;
  gap: 0.15rem;
  padding: 0.45rem 0.6rem;
  pointer-events: none;
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
}
.featured-visuallyHidden {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>
