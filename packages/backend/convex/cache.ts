/**
 * Action Cache component.
 *
 * Create cache instances per action:
 * ```ts
 * import { ActionCache } from "@convex-dev/action-cache";
 * import { components, internal } from "./_generated/api";
 *
 * export const myCache = new ActionCache(components.actionCache, {
 *   action: internal.myModule.expensiveAction,
 *   name: "my-cache-v1",
 * });
 *
 * // Then in an action:
 * const result = await myCache.fetch(ctx, { arg: "value" });
 * ```
 */
export { ActionCache } from "@convex-dev/action-cache";
