import { describe, expect, it } from 'vitest';
import { CarouselWindowModel } from '../../src/slider/carouselWindow';

describe('CarouselWindowModel', () => {
  it('waits for the viewer to leave the first slide before prefetching', () => {
    const model = new CarouselWindowModel(['a', 'b'], true);

    expect(model.shouldPrefetch(5, 2)).toBe(false);
    expect(model.activate(1, 2, 2, true)).toBe(true);
    expect(model.shouldPrefetch(5, 2)).toBe(true);
  });

  it('deduplicates batches and remembers an index waiting for more items', () => {
    const model = new CarouselWindowModel(['a'], true);

    expect(model.activate(1, 1, 1, true)).toBe(false);
    expect(model.acceptBatch([{ id: 'a' }, { id: 'b' }, { id: 'b' }], true, 500)).toEqual([{ id: 'b' }]);
    expect(model.takePendingIndex()).toBe(1);
    expect(model.takePendingIndex()).toBeNull();
  });

  it('bounds remembered IDs without accepting duplicates from the same batch', () => {
    const model = new CarouselWindowModel(['old'], true);

    expect(model.acceptBatch([{ id: 'new' }, { id: 'new' }], true, 1)).toEqual([{ id: 'new' }]);
    expect(model.getExcludedItemIds()).toEqual(['new']);
  });

  it('keeps absolute position while trimming an old cached prefix', () => {
    const model = new CarouselWindowModel([], true);
    model.index = 90;
    model.setRenderedWindowStart(80);

    expect(model.trimDiscardedPrefix(120, 100)).toBe(20);
    expect(model.index).toBe(70);
    expect(model.windowStart).toBe(60);
    expect(model.discardedItemCount).toBe(20);
  });
});
