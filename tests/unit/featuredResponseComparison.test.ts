import { describe, expect, it } from 'vitest';
import { hasSameFeaturedSettings, isSameFeaturedResponse } from '../../src/core/featuredCache';
import type { FeaturedItem, FeaturedResponse } from '../../src/types/featured';

const item = (id: string): FeaturedItem => ({ id, name: id }) as FeaturedItem;
const response = (ids: string[], overrides: Partial<FeaturedResponse> = {}): FeaturedResponse =>
  ({ items: ids.map(item), autoplay: true, hasMore: false, ...overrides }) as FeaturedResponse;

describe('fresh response comparison', () => {
  it('treats equal responses as the same', () => {
    expect(isSameFeaturedResponse(response(['a', 'b']), response(['a', 'b']))).toBe(true);
  });

  it('notices changed items and settings', () => {
    expect(isSameFeaturedResponse(response(['a', 'b']), response(['b', 'a']))).toBe(false);
    expect(isSameFeaturedResponse(response(['a']), response(['a'], { autoplay: false }))).toBe(false);
  });

  it('does not treat a longer fresh response as the truncated cached one', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(isSameFeaturedResponse(response(six.slice(0, 5)), response(six))).toBe(false);
  });

  it('compares settings independently of the items', () => {
    expect(hasSameFeaturedSettings(response(['a']), response(['b', 'c']))).toBe(true);
    expect(hasSameFeaturedSettings(response(['a']), response(['a'], { hasMore: true }))).toBe(false);
  });
});
