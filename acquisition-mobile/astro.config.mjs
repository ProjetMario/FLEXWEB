import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://flex-web.fr",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  build: { format: "directory", assets: "mobile-assets", inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
