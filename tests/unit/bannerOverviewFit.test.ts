import { describe, expect, it, vi } from 'vitest';
import { fitFeaturedOverview, OverviewFitGuard } from '../../src/slider/overviewFit';

describe('adaptive banner overview fitting', () => {
  it('reduces banner overview lines before the viewport clips following content', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const root = document.createElement('section');
    root.className = 'featured-root featured-ready';
    const slide = document.createElement('div');
    slide.className = 'featured-slide is-active';
    const content = document.createElement('div');
    content.className = 'featured-content';
    content.style.paddingBottom = '10px';
    const overview = document.createElement('div');
    overview.className = 'featured-overview';
    const actions = document.createElement('div');
    actions.className = 'featured-actions';
    content.append(overview, actions);
    slide.appendChild(content);
    root.appendChild(slide);
    document.body.appendChild(root);

    Object.defineProperty(content, 'clientHeight', { value: 100 });
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    for (const child of [overview, actions])
      vi.spyOn(child, 'getClientRects').mockReturnValue([rect(0, 1)] as unknown as DOMRectList);
    vi.spyOn(overview, 'getBoundingClientRect').mockReturnValue(rect(20, 70));
    vi.spyOn(actions, 'getBoundingClientRect').mockImplementation(() => {
      if (content.classList.contains('featured-overview-lines-2')) return rect(75, 88);
      if (content.classList.contains('featured-overview-lines-1')) return rect(65, 85);
      return rect(79, 99);
    });

    expect(fitFeaturedOverview(content)).toBe(2);
    expect(content.classList.contains('featured-overview-lines-2')).toBe(true);
  });

  it('owns resize and load observers for the active content', () => {
    const content = document.createElement('div');
    document.body.appendChild(content);
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const guard = new OverviewFitGuard(() => content);

    guard.start();
    guard.destroy();

    expect(addWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addDocument).toHaveBeenCalledWith('load', expect.any(Function), true);
    expect(removeDocument).toHaveBeenCalledWith('load', expect.any(Function), true);
  });
});

function rect(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    toJSON: () => ({})
  } as DOMRect;
}
