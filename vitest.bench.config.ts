import aliases from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    target: "es2020"
  },
  plugins: [aliases()],
  test: {
    include: ["packages/effect/benchmark/**/*.bench.ts"],
    setupFiles: []
  }
})
