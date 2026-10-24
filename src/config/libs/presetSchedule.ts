import type { FeaturedPreset } from '../../types/config';

export type PresetScheduleState = 'disabled' | 'active' | 'scheduled' | 'expired' | 'recurring';

export interface ActivePreset {
  preset: FeaturedPreset;
  /** End of the running window: an absolute time for one-time presets, a wall time in the preset's zone otherwise. */
  endsAt: Date | null;
  endsAtIsWallTime: boolean;
}

interface Window {
  start: number;
  end: number;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Mirrors FeaturedPresetResolver so the editor can say which preset applies right now. Recurring windows are compared
 * as wall times in the preset's time zone; the server's DST-gap handling only shifts boundaries by minutes.
 */
export function resolveActivePreset(presets: readonly FeaturedPreset[], now = new Date()): ActivePreset | null {
  const candidates = presets
    .map((preset, index) => ({ preset, index, window: activeWindow(preset, now) }))
    .filter((candidate): candidate is { preset: FeaturedPreset; index: number; window: Window } => !!candidate.window)
    .sort((a, b) => b.preset.Priority - a.preset.Priority || b.window.start - a.window.start || a.index - b.index);
  const winner = candidates[0];
  if (!winner) return null;
  const finite = Number.isFinite(winner.window.end);
  return {
    preset: winner.preset,
    endsAt: finite ? new Date(winner.window.end) : null,
    endsAtIsWallTime: winner.preset.ScheduleType !== 'one_time'
  };
}

export function presetScheduleState(preset: FeaturedPreset, now = new Date()): PresetScheduleState {
  if (!preset.Enabled) return 'disabled';
  if (activeWindow(preset, now)) return 'active';
  if (preset.ScheduleType !== 'one_time') return 'recurring';
  const starts = preset.StartsAt ? new Date(preset.StartsAt).getTime() : Number.NEGATIVE_INFINITY;
  return now.getTime() < starts ? 'scheduled' : 'expired';
}

function activeWindow(preset: FeaturedPreset, now: Date): Window | null {
  if (!preset.Enabled) return null;
  if (preset.ScheduleType === 'weekly') return latestContaining(weeklyWindows(preset, now), wallTime(now, preset));
  if (preset.ScheduleType === 'annual') return latestContaining(annualWindows(preset, now), wallTime(now, preset));
  const start = preset.StartsAt ? new Date(preset.StartsAt).getTime() : Number.NEGATIVE_INFINITY;
  const end = preset.EndsAt ? new Date(preset.EndsAt).getTime() : Number.POSITIVE_INFINITY;
  const time = now.getTime();
  return start <= time && time < end ? { start, end } : null;
}

function latestContaining(windows: Window[], time: number): Window | null {
  return (
    windows.filter((window) => window.start <= time && time < window.end).sort((a, b) => b.start - a.start)[0] ?? null
  );
}

function weeklyWindows(preset: FeaturedPreset, now: Date): Window[] {
  if (!preset.DaysOfWeek.length) return [];
  const today = Math.floor(wallTime(now, preset) / DAY) * DAY;
  const start = parseTime(preset.StartTime, 18 * 60);
  const end = parseTime(preset.EndTime, 23 * 60 + 59);
  const windows: Window[] = [];
  for (const offset of [-1, 0]) {
    const day = today + offset * DAY;
    if (!preset.DaysOfWeek.includes(new Date(day).getUTCDay())) continue;
    const windowStart = day + start * MINUTE;
    let windowEnd = day + end * MINUTE;
    if (windowEnd <= windowStart) windowEnd += DAY;
    windows.push({ start: windowStart, end: windowEnd });
  }
  return windows;
}

function annualWindows(preset: FeaturedPreset, now: Date): Window[] {
  const year = new Date(wallTime(now, preset)).getUTCFullYear();
  const start = parseTime(preset.StartTime, 0);
  const end = parseTime(preset.EndTime, 23 * 60 + 59);
  const windows: Window[] = [];
  for (const candidate of [year - 1, year]) {
    const windowStart = annualBoundary(candidate, preset.AnnualStart, start, 12, 1);
    let windowEnd = annualBoundary(candidate, preset.AnnualEnd, end, 12, 31);
    if (windowEnd <= windowStart) windowEnd = annualBoundary(candidate + 1, preset.AnnualEnd, end, 12, 31);
    windows.push({ start: windowStart, end: windowEnd });
  }
  return windows;
}

function annualBoundary(
  year: number,
  monthDay: string,
  minutes: number,
  fallbackMonth: number,
  fallbackDay: number
): number {
  const [monthText, dayText] = (monthDay ?? '').split('-');
  const parsedMonth = Number(monthText);
  const month = Number.isInteger(parsedMonth) && monthText ? Math.min(Math.max(parsedMonth, 1), 12) : fallbackMonth;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const parsedDay = Number(dayText);
  const day = Number.isInteger(parsedDay) && dayText ? Math.min(Math.max(parsedDay, 1), daysInMonth) : fallbackDay;
  return Date.UTC(year, month - 1, day) + minutes * MINUTE;
}

function parseTime(value: string, fallback: number): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : fallback;
}

/** The current wall time in the preset's zone, encoded as a UTC timestamp so day arithmetic stays simple. */
function wallTime(now: Date, preset: FeaturedPreset): number {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: preset.TimeZoneId || 'UTC',
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
        .formatToParts(now)
        .map((part) => [part.type, Number(part.value)])
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  } catch {
    return Math.floor(now.getTime() / MINUTE) * MINUTE;
  }
}
