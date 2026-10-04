import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Hanya logika murni yang diuji di sini (tanpa DOM), jadi cukup node.
// Lihat node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
