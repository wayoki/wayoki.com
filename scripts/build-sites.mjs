import { cp, mkdir, rm } from "node:fs/promises";

const source = new URL("../", import.meta.url);
const output = new URL("dist/", source);
const publicPaths = [
    "index.html",
    "CNAME",
    ".nojekyll",
    "assets",
    "en",
    "ru",
    "collab/site-ui/theme-registry.js",
    "collab/site-ui/themes.css",
    "collab/site-ui/themes"
];

await rm(output, { recursive: true, force: true });
await mkdir(new URL("collab/site-ui/", output), { recursive: true });

for (const path of publicPaths) {
    await cp(new URL(path, source), new URL(path, output), { recursive: true });
}
