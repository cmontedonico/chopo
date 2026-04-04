import { internalMutation } from "./_generated/server";
import { seedDefaultAnalytes } from "./labAnalyteCatalog";

export const seedDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    return seedDefaultAnalytes(ctx);
  },
});
