import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Nodes, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { beforeAll, describe, expect, it } from "vitest";
import { HIGHLIGHT_COLORS } from "../src/highlights.js";
import remarkObsidianMd, { mapResolver } from "../src/index.js";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/** Resolves a package `exports` subpath the way a consumer's bundler does. */
function resolveExport(subpath: string): string {
  const target = pkg.exports?.[subpath];
  if (typeof target !== "string") {
    throw new Error(`package exports has no "${subpath}" entry`);
  }
  return resolve(root, target);
}

/** The CSS of an entry point, with relative `@import`s inlined. */
function readCss(file: string): string {
  return readFileSync(file, "utf8").replace(
    /@import\s+(?:url\()?["']([^"']+)["']\)?[^;]*;/g,
    (_, path: string) => readCss(resolve(dirname(file), path)),
  );
}

/** The hooks the plugin emits: the elements and attributes a Stylesheet targets. */
function collectHooks(markdown: string): Set<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, {
      resolver: mapResolver({
        Known: { path: "/Known.md" },
        "Cycle A": { path: "/Cycle A.md" },
        "Cycle B": { path: "/Cycle B.md" },
      }),
      embeds: {
        readNote: (path: string) =>
          path === "/Cycle A.md" ? "A ![[Cycle B]]" : "B ![[Cycle A]]",
      },
    });
  const tree: Root = processor.runSync(processor.parse(markdown));
  const hooks = new Set<string>();

  visit(tree, (node: Nodes) => {
    const data = (node.data ?? {}) as {
      hName?: string;
      hProperties?: Record<string, unknown>;
    };
    if (data.hName === "mark") hooks.add("mark");
    const props = data.hProperties ?? {};
    const color = props["data-highlight"];
    if (typeof color === "string") hooks.add(`[data-highlight="${color}"]`);
    for (const name of [props.className ?? []].flat() as string[]) {
      // Resolved Embeds stay unstyled; only state classes need a rule.
      if (name.startsWith("is-")) hooks.add(`.${name}`);
    }
  });

  return hooks;
}

describe("Stylesheet package boundary", () => {
  beforeAll(() => {
    execSync("pnpm build", { cwd: root, stdio: "pipe" });
  }, 120_000);

  it("resolves both CSS entry points through package exports to built files", () => {
    for (const subpath of ["./styles.css", "./styles/base.css"]) {
      expect(existsSync(resolveExport(subpath)), subpath).toBe(true);
    }
  });

  it("styles every hook the plugin emits", () => {
    const colors = [...new Set(Object.keys(HIGHLIGHT_COLORS))];
    const markdown = [
      "==plain==",
      ...colors.map((emoji) => `==${emoji} colored **x**==`),
      "[[Missing]] [[Known]]",
      "![[Missing]]",
      "![[Cycle A]]",
    ].join("\n\n");

    const hooks = collectHooks(markdown);
    const css = readCss(resolveExport("./styles.css"));

    expect(hooks).toContain("mark");
    expect(hooks).toContain(".is-unresolved");
    expect(hooks).toContain(".is-embed-limit");
    for (const color of new Set(Object.values(HIGHLIGHT_COLORS))) {
      expect(hooks).toContain(`[data-highlight="${color}"]`);
    }
    for (const hook of hooks) {
      expect(css, `no rule for ${hook}`).toContain(hook);
    }
  });
});
