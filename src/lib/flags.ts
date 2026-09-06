/**
 * Feature flags for work that ships in the codebase before it ships to users.
 *
 * A flag here means the code is finished enough to keep, but not proven enough
 * to publish: flipping one back to `true` is the whole re-enable, so nothing has
 * to be rebuilt from a deleted branch later.
 */
export const FEATURES = {
  /**
   * A/B Compare (`/compare`). Off until the flow has actually been tested and we
   * know which comparison is the useful one. The route still exists and still
   * builds; only its entry point in the app bar is hidden, and the page carries
   * a noindex so a publish does not put it in front of anyone.
   */
  abCompare: false,
} as const;
