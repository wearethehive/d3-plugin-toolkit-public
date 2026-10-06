import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/lib/__tests__/**/*.test.mjs"],
    // Hook integration tests spawn fresh Node processes. Cold Windows process
    // startup can exceed Vitest's 5s default even though the hook itself has a
    // 10s execution timeout.
    testTimeout: 15000,
  },
});
