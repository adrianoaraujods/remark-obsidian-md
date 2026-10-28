import type { Paragraph, Root, Strong } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianHighlights } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md" },
  Note: { path: "/Note.md" },
});

function process(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, { resolver });

  return processor.runSync(processor.parse(markdown));
}

function processStandalone(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianHighlights);

  return processor.runSync(processor.parse(markdown));
}

/** The Highlight node of the first paragraph of a Note. */
function highlightOf(tree: Root) {
  const paragraph = tree.children[0] as Paragraph;

  return paragraph.children[0];
}

describe("Highlights", () => {
  it("turns ==text== into a mark element", () => {
    const tree = process("A ==marked== word");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "A " },
        { type: "text", value: "marked", data: { hName: "mark" } },
        { type: "text", value: " word" },
      ],
    });
  });

  it("transforms highlights in headings, lists, emphasis and strong", () => {
    const tree = process("# ==a==\n\n- ==b==\n\n**==c==** and _==d==_");

    const marks = JSON.stringify(tree).match(/"hName":"mark"/g) ?? [];
    expect(marks).toHaveLength(4);
  });

  it("parses a highlight's content as inline Markdown", () => {
    const tree = process("==**bold**==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "obsidianHighlight",
          value: "==**bold**==",
          data: { hName: "mark", hProperties: {} },
          children: [
            { type: "strong", children: [{ type: "text", value: "bold" }] },
          ],
        },
      ],
    });
  });

  it("parses an italic inside a highlight", () => {
    const tree = process("==*em*==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      children: [
        { type: "emphasis", children: [{ type: "text", value: "em" }] },
      ],
    });
  });

  it("parses code inside a highlight", () => {
    const tree = process("==`code`==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      children: [{ type: "inlineCode", value: "code" }],
    });
  });

  it("resolves a Wiki Link inside a highlight", () => {
    const tree = process("==[[Wiki Link]]==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      children: [
        {
          type: "link",
          url: "/wiki-link",
          children: [{ type: "text", value: "Wiki Link" }],
        },
      ],
    });
  });

  it("resolves a Footnote inside a highlight", () => {
    const tree = process("==x^[[[Note|Alias]]]==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      value: "==x^[[[Note|Alias]]]==",
      data: { hName: "mark", hProperties: {} },
      children: [
        { type: "text", value: "x" },
        {
          type: "obsidianFootnote",
          value: "[[Note|Alias]]",
          data: { hName: "sup", hProperties: {} },
          children: [
            {
              type: "link",
              url: "/note",
              children: [{ type: "text", value: "Alias" }],
            },
          ],
        },
      ],
    });
  });

  it("removes a Comment inside a highlight", () => {
    const tree = process("==%%comment%%==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      data: { hName: "mark", hProperties: {} },
      children: [],
    });
    expect(JSON.stringify(tree)).not.toContain("obsidianComment");
  });

  it("keeps a plain highlight a text node", () => {
    const tree = process("==marked==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "marked", data: { hName: "mark" } }],
    });
  });

  it("does not transform highlight colors", () => {
    const tree = process("==🔴red==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "==🔴red==" }],
    });
  });

  it("does not transform a highlight color holding elements", () => {
    const tree = process("==🔴red **bold**==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "==🔴red **bold**==" }],
    });
  });

  it("turns a highlight inside a footnote into a mark element", () => {
    const tree = process("Note^[==highlight==]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        {
          type: "obsidianFootnote",
          children: [
            { type: "text", value: "highlight", data: { hName: "mark" } },
          ],
        },
      ],
    });
  });

  it("keeps block Markdown inside a highlight literal", () => {
    const tree = process("==# heading==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "# heading", data: { hName: "mark" } }],
    });
  });

  it("keeps an Embed inside a highlight literal", () => {
    const tree = process("==![[Wiki Link]]==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "![[Wiki Link]]", data: { hName: "mark" } },
      ],
    });
  });

  it("points the parsed children at the highlight's content range", () => {
    const tree = process("==**bold**==");
    const strong = (highlightOf(tree) as { children: Strong[] }).children[0];
    const range = {
      start: { line: 1, column: 3, offset: 2 },
      end: { line: 1, column: 11, offset: 10 },
    };

    expect(strong?.position).toEqual(range);
    expect(strong?.children?.[0]?.position).toEqual(range);
  });

  it("leaves highlights inside code alone", () => {
    const tree = process("`==inline==`\n\n```\n==block==\n```");

    expect(JSON.stringify(tree)).not.toContain('"mark"');
  });

  it("transforms highlights through the per-feature plugin", () => {
    const tree = processStandalone("==marked==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "marked", data: { hName: "mark" } }],
    });
  });

  it("parses a highlight's content as inline Markdown through the per-feature plugin", () => {
    const tree = processStandalone("==**bold**==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "obsidianHighlight",
          value: "==**bold**==",
          data: { hName: "mark", hProperties: {} },
          children: [
            { type: "strong", children: [{ type: "text", value: "bold" }] },
          ],
        },
      ],
    });
  });
});
