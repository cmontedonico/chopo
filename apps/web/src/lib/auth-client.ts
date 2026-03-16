import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { env } from "@chopo-v1/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.VITE_CONVEX_SITE_URL,
  plugins: [crossDomainClient(), convexClient()],
});
