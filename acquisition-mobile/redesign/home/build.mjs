// Build only the two home pages. The catalogue deployment overlays these files.
import { build } from "astro";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL("./", import.meta.url));
await build({ root: here });
