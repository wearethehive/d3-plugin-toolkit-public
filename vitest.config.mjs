import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/lib/__tests__/**/*.test.mjs"],
  },
});
