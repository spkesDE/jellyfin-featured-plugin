import { describe, expect, it, vi } from 'vitest';
import { cloneJsonValue } from '../../src/core/clone';
import { replaceElementChildren } from '../../src/core/dom';
import { createId } from '../../src/core/id';

describe('core browser compatibility helpers', () => {
  it('deep-clones JSON-shaped values', () => {
    const source = { nested: { values: ['one', 'two'] } };
    const clone = cloneJsonValue(source);

    clone.nested.values.push('three');

    expect(clone).not.toBe(source);
    expect(source.nested.values).toEqual(['one', 'two']);
  });

  it('replaces all element children on legacy browsers', () => {
    const parent = document.createElement('div');
    parent.append(document.createElement('span'), document.createTextNode('old'));
    const replacement = document.createElement('strong');

    replaceElementChildren(parent, replacement);

    expect(parent.firstChild).toBe(replacement);
    expect(parent.childNodes).toHaveLength(1);
  });

  it('creates a fallback identifier when randomUUID is unavailable', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    try {
      expect(createId()).toBe('1234-8');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
    }
  });
});
