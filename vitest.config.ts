import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@hm/shared": fileURLToPath(new URL("./packages/shared/src", import.meta.url)),
      "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)),
      "server-only": fileURLToPath(new URL("./packages/shared/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/web/test/**/*.test.ts", "apps/extension/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
  },
});
