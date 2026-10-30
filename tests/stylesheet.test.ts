import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Nodes, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { beforeAll, describe, expect, it } from "vitest";
import { CALLOUT_ALIASES, CALLOUT_TYPES } from "../src/callouts.js";
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

/** Whether some selector in the CSS targets `hook` inside the Rendered Container. */
function hasScopedRule(css: string, hook: string): boolean {
  return [...css.matchAll(/([^{}]+)\{/g)]
    .flatMap((match) => match[1].split(","))
    .some(
      (selector) =>
        selector.includes(":where(.markdown-rendered)") &&
        selector.includes(hook),
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
    const icon = props["data-icon"];
    if (typeof icon === "string") hooks.add(`[data-icon="${icon}"]`);
    const type = props["data-callout"];
    if (typeof type === "string") hooks.add(`[data-callout="${type}"]`);
    for (const name of [props.className ?? []].flat() as string[]) {
      // Resolved Embeds stay unstyled; only state classes need a rule.
      if (name.startsWith("is-") || name.startsWith("callout")) {
        hooks.add(`.${name}`);
      }
    }
  });

  return hooks;
}

describe("Stylesheet package boundary", () => {
  beforeAll(() => {
    execSync("pnpm build", { cwd: root, stdio: "pipe" });
  }, 120_000);

  it("resolves both CSS entry points through package exports to built files", () => {
    for (const subpath of [
      "./styles.css",
      "./styles/base.css",
      "./styles/dark-media.css",
      "./styles/dark-class.css",
    ]) {
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
      expect(hasScopedRule(css, hook), `no scoped rule for ${hook}`).toBe(true);
    }
  });

  it("styles every Callout Type, alias and Callout part the plugin emits", () => {
    const types = [
      ...Object.keys(CALLOUT_TYPES),
      ...Object.keys(CALLOUT_ALIASES),
    ];
    const markdown = [
      ...types.map((type) => `> [!${type}] Title\n> body`),
      "> [!note]- Folded\n> body",
      "> [!note]+ Open\n> body",
      "> [!unknown-type] Typo\n> body",
    ].join("\n\n");

    const hooks = collectHooks(markdown);
    const css = readCss(resolveExport("./styles.css"));

    for (const hook of [
      ".callout",
      ".callout-title",
      ".callout-title-inner",
      ".callout-title-icon",
      ".callout-content",
      ".is-collapsible",
    ]) {
      expect(hooks, hook).toContain(hook);
    }
    for (const type of Object.keys(CALLOUT_TYPES)) {
      expect(hooks).toContain(`[data-callout="${type}"]`);
    }
    for (const hook of hooks) {
      expect(hasScopedRule(css, hook), `no scoped rule for ${hook}`).toBe(true);
    }
    for (const { icon } of Object.values(CALLOUT_TYPES)) {
      expect(hooks).toContain(`[data-icon="${icon}"]`);
    }
    for (const alias of Object.keys(CALLOUT_ALIASES)) {
      expect(
        hasScopedRule(css, `[data-callout="${alias}"]`),
        `no scoped rule for alias ${alias}`,
      ).toBe(true);
    }
  });

  it("accepts any CSS color for --callout-color", () => {
    // `callouts.types[x].color` is emitted verbatim as `--callout-color`, so
    // it can be a name, hex or triplet-free color. Wrapping it in rgb() would
    // silently drop the tinted background and border.
    const css = readCss(resolveExport("./styles.css"));

    expect(css).not.toMatch(/rgba?\(\s*var\(--callout-color\)/);
    expect(css).toMatch(
      /background-color:\s*color-mix\([^;]*var\(--callout-color\)/,
    );
  });

  it("maps Callout Types to Obsidian's palette colors", () => {
    const css = readCss(resolveExport("./styles.css"));
    const colorOf = (type: string) => {
      const rule = css.match(
        new RegExp(
          `\\[data-callout="${type}"\\][^{]*\\{[^}]*--callout-color:\\s*var\\(--color-([a-z0-9-]+)`,
        ),
      );
      return rule?.[1];
    };

    expect(colorOf("note")).toBe("blue");
    expect(colorOf("info")).toBe("blue");
    expect(colorOf("todo")).toBe("blue");
    expect(colorOf("tip")).toBe("cyan");
    expect(colorOf("abstract")).toBe("cyan");
    expect(colorOf("success")).toBe("green");
    expect(colorOf("question")).toBe("orange");
    expect(colorOf("warning")).toBe("orange");
    expect(colorOf("bug")).toBe("red");
    expect(colorOf("example")).toBe("purple");
    expect(colorOf("quote")).toBe("base-60");
  });

  it("ships the Lucide license notice in the published package", () => {
    expect(pkg.files).toContain("LICENSE-LUCIDE");
    expect(readFileSync(resolve(root, "LICENSE-LUCIDE"), "utf8")).toContain(
      "ISC License",
    );
  });

  describe("dark mode", () => {
    const base = () => readCss(resolveExport("./styles/base.css"));
    const media = () => readCss(resolveExport("./styles/dark-media.css"));
    const klass = () => readCss(resolveExport("./styles/dark-class.css"));
    const tokens = [
      "--color-red",
      "--color-orange",
      "--color-yellow",
      "--color-green",
      "--color-blue",
      "--color-purple",
      "--color-cyan",
    ];

    it("gives the media and class files the same palette values", () => {
      const palette = (css: string) =>
        Object.fromEntries(
          [...css.matchAll(/(--color-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
            m[1],
            m[2].trim(),
          ]),
        );

      expect(Object.keys(palette(media())).length).toBeGreaterThan(0);
      expect(palette(klass())).toEqual(palette(media()));
    });

    it("keys the media file on prefers-color-scheme", () => {
      expect(media()).toContain("prefers-color-scheme: dark");
    });

    it("keys the class file on all three dark selectors, not the media query", () => {
      const css = klass();
      for (const selector of [".dark", ".theme-dark", '[data-theme="dark"]']) {
        expect(css, selector).toContain(selector);
      }
      expect(css).not.toContain("prefers-color-scheme");
    });

    it("matches an ancestor of the Rendered Container or the container itself", () => {
      const css = klass();
      expect(css).toContain(".dark .markdown-rendered");
      expect(css).toContain(".dark.markdown-rendered");
    });

    it("defines the same palette in both files", () => {
      for (const token of tokens) {
        expect(media(), token).toContain(`${token}:`);
        expect(klass(), token).toContain(`${token}:`);
      }
    });

    it("keeps the base free of dark palettes", () => {
      expect(base()).not.toContain("prefers-color-scheme");
      expect(base()).not.toContain("dark");
    });

    it("makes the default bundle the base plus the media file", () => {
      const css = readCss(resolveExport("./styles.css"));
      expect(css).toContain(base());
      expect(css).toContain("prefers-color-scheme: dark");
    });
  });
});
