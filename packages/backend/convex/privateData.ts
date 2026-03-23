import { query } from "./_generated/server";
import { requireAuth } from "./lib/authorization";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return {
      message: "This is private",
    };
  },
});
