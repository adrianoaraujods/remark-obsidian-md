import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianEmbeds } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import type {
  EmbedsPluginOptions,
  RemarkObsidianMdOptions,
} from "../src/types.js";

const notes: Record<string, string> = {
  "/A.md": "Alpha content",
  "/B.md": "Bravo content",
  "/C.md": "Charlie content",
  "/D.md": "Delta content",
  "/Cycle A.md": "Cycle A body ![[Cycle B]]",
  "/Cycle B.md": "Cycle B body ![[Cycle A]]",
  "/Link.md": "Link content",
  "/Styled.md": "Styled content",
  "/Chain A.md": "Chain A body ![[Chain B]]",
  "/Chain B.md": "Chain B body ![[Chain C]]",
  "/Chain C.md": "Chain C body",
  "/Nested.md": [
    "Intro [[Link]]",
    "",
    "> [!note] Callout body",
    "",
    "==Highlighted==",
  ].join("\n"),
};

const resolver = mapResolver({
  A: { path: "/A.md" },
  B: { path: "/B.md" },
  C: { path: "/C.md" },
  D: { path: "/D.md" },
  "Cycle A": { path: "/Cycle A.md" },
  "Cycle B": { path: "/Cycle B.md" },
  Link: { path: "/Link.md" },
  Styled: { path: "/Styled.md", cssclasses: ["wide", "red"] },
  "Chain A": { path: "/Chain A.md" },
  "Chain B": { path: "/Chain B.md" },
  "Chain C": { path: "/Chain C.md" },
  Nested: { path: "/Nested.md" },
});

function readNote(path: string): string | undefined {
  return notes[path];
}

function process(
  markdown: string,
  options: RemarkObsidianMdOptions = {},
): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, { resolver, embeds: { readNote }, ...options });

  return processor.runSync(processor.parse(markdown));
}

describe("remarkObsidianEmbeds", () => {
  it("transcludes a whole Note into the embed node's children", () => {
    const tree = process("![[A]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Alpha content" }],
        },
      ],
    });
  });

  it("promotes a lone Embed to block position as a div", () => {
    const tree = process("![[A]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: { hName: "div", hProperties: { className: ["internal-embed"] } },
    });
  });

  it("keeps a mid-text Embed inline as a span", () => {
    const tree = process("before ![[A]] after");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "before " },
        {
          type: "embed",
          data: {
            hName: "span",
            hProperties: { className: ["internal-embed"] },
          },
        },
        { type: "text", value: " after" },
      ],
    });
  });

  it("carries the embedded Note's CSS Classes on the container", () => {
    const tree = process("![[Styled]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "wide", "red"] },
      },
    });
  });

  it("renders an unresolved Embed as a marked placeholder", () => {
    const tree = process("![[Missing]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "is-unresolved"] },
      },
      children: [{ type: "text", value: "Missing" }],
    });
  });

  it("survives a cycle through the visited-set guard", () => {
    const tree = process("![[Cycle A]]");
    const json = JSON.stringify(tree);

    expect(json.match(/Cycle A body/g)).toHaveLength(1);
    expect(json.match(/Cycle B body/g)).toHaveLength(1);
    expect(json.match(/is-unresolved/g)).toHaveLength(1);
  });

  it("stops transcluding at the depth limit", () => {
    const tree = process("![[Chain A]]", {
      embeds: { readNote, maxDepth: 2 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain("Chain B body");
    expect(json).not.toContain("Chain C body");
    expect(json.match(/is-unresolved/g)).toHaveLength(1);
  });

  it("transforms Wiki Links, Callout bodies and Highlights in transcluded content", () => {
    const tree = process("![[Nested]]");
    const json = JSON.stringify(tree);

    expect(json).toContain('"url":"/link"');
    expect(json).toContain('"hName":"mark"');
    // The Callout transform runs after Embeds and consumes this blockquote.
    expect(json).toMatch(/"type":"(blockquote|callout)"/);
    expect(json).toContain("Callout body");
  });
});

function processEmbed(
  markdown: string,
  options: Omit<EmbedsPluginOptions, "resolver" | "readNote"> = {},
): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianEmbeds, { resolver, readNote, ...options });

  return processor.runSync(processor.parse(markdown));
}

describe("remarkObsidianEmbeds (standalone)", () => {
  it("transcludes a Note through the per-feature plugin", () => {
    const tree = processEmbed("![[A]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: { hName: "div" },
      children: [{ type: "paragraph" }],
    });
  });
});
