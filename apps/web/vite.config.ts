import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function getManualChunkName(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) {
    return "vendor-charts";
  }

  if (
    id.includes("@base-ui/") ||
    id.includes("@floating-ui/") ||
    id.includes("tabbable") ||
    id.includes("react-transition-group")
  ) {
    return "vendor-ui";
  }

  if (
    id.includes("@tanstack/") ||
    id.includes("tiny-invariant") ||
    id.includes("tiny-warning")
  ) {
    return "vendor-tanstack";
  }

  if (
    id.includes("convex") ||
    id.includes("@convex-dev/") ||
    id.includes("better-auth") ||
    id.includes("better-fetch")
  ) {
    return "vendor-auth";
  }

  if (id.includes("zod") || id.includes("@t3-oss/")) {
    return "vendor-validation";
  }

  if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler")) {
    return "vendor-react";
  }

  return undefined;
}

export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getManualChunkName(id);
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
  },
});
