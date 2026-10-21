import { Workpool } from "@convex-dev/workpool";

import { components } from "./_generated/api";

export const defaultPool = new Workpool(components.defaultPool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    base: 2,
  },
});
