const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the viewer asked the system to minimise motion; slides then stay put and no background video starts. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
  } catch {
    return false;
  }
}
