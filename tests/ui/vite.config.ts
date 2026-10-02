import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path("./"),
  publicDir: path("../../public"),
  resolve: { alias: [
    { find: "@/app/actions", replacement: path("./actions.ts") },
    { find: "@", replacement: path("../../src") },
  ] },
  server: { host: "127.0.0.1", port: 4173, strictPort: true, fs: { allow: [path("../../")] } },
  css: { postcss: path("../../") },
});
