import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  outDir: fileURLToPath(new URL("../../.release/redesign/home/", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../../.release/redesign/home-cache/", import.meta.url)),
  build: { format: "directory", inlineStylesheets: "always" },
  site: "https://flex-web.fr",
  trailingSlash: "always",
  devToolbar: { enabled: false },
});
