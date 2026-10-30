// Ships the Stylesheet: tsc only emits TypeScript, so the CSS is copied
// from src into dist, where the package `exports` point.
import { cpSync } from "node:fs";

cpSync("src/styles.css", "dist/styles.css");
cpSync("src/styles", "dist/styles", { recursive: true });
