import { describe, expect, it } from 'vitest';
import { shouldScheduleRuntimeScan } from '../../src/core/runtimeMutationPolicy';

describe('runtime mutation policy', () => {
  it('mounts a newly added home surface only when no mount is already tracked', () => {
    const host = document.createElement('div');
    const home = document.createElement('div');
    home.id = 'homeTab';
    const mutation = childListMutation(host, [home]);

    expect(shouldScheduleRuntimeScan([mutation], false, false)).toBe(true);
    expect(shouldScheduleRuntimeScan([mutation], true, false)).toBe(false);
  });

  it('recovers a disconnected tracked mount without treating plugin DOM as page navigation', () => {
    const pluginRoot = document.createElement('section');
    pluginRoot.className = 'featured-root';
    const pluginChild = document.createElement('div');
    pluginRoot.appendChild(pluginChild);
    const mutation = childListMutation(pluginRoot, [pluginChild]);

    expect(shouldScheduleRuntimeScan([mutation], false, false)).toBe(false);
    expect(shouldScheduleRuntimeScan([mutation], true, true)).toBe(true);
  });
});

function childListMutation(target: Node, addedNodes: Node[]): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: addedNodes as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    oldValue: null,
    previousSibling: null
  };
}
