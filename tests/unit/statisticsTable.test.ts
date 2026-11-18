import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import StatisticsTable, { type StatisticsRow } from '../../src/config/components/StatisticsTable.vue';

let app: App | null = null;

function mountTable(rows: StatisticsRow[]): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({ render: () => h(StatisticsTable, { rows, barColor: '#3987e5' }) });
  app.mount(host);
  return host;
}

const row = (name: string, impressions: number, opens = 0): StatisticsRow => ({
  id: name,
  name,
  type: 'Movie',
  impressions,
  opens,
  plays: 0,
  lastShownAt: null
});

const titles = (host: HTMLElement): string[] =>
  [...host.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td')?.textContent?.trim() ?? '');

describe('statistics data table', () => {
  afterEach(() => {
    app?.unmount();
    app = null;
  });

  it('sorts by impressions first and toggles a column when clicked twice', async () => {
    const host = mountTable([row('Beta', 5), row('Alpha', 20), row('Gamma', 10)]);
    expect(titles(host)).toEqual(['Alpha', 'Gamma', 'Beta']);

    const nameHeader = host.querySelectorAll<HTMLButtonElement>('th button')[0];
    nameHeader.click();
    await nextTick();
    expect(titles(host)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(host.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');

    nameHeader.click();
    await nextTick();
    expect(titles(host)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('filters by title and pages through the result', async () => {
    const rows = Array.from({ length: 30 }, (_, index) => row(`Movie ${index + 1}`, 100 - index));
    const host = mountTable(rows);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(25);

    host.querySelectorAll<HTMLButtonElement>('.featured-dataTablePagerButtons button')[2].click();
    await nextTick();
    expect(titles(host)).toEqual(['Movie 26', 'Movie 27', 'Movie 28', 'Movie 29', 'Movie 30']);

    const search = host.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'movie 1';
    search.dispatchEvent(new Event('input'));
    await nextTick();
    expect(titles(host)).toEqual([
      'Movie 1',
      'Movie 10',
      'Movie 11',
      'Movie 12',
      'Movie 13',
      'Movie 14',
      'Movie 15',
      'Movie 16',
      'Movie 17',
      'Movie 18',
      'Movie 19'
    ]);
  });
});
