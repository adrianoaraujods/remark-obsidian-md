import type { Emphasis, Heading, Paragraph, Parent, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianFootnotes } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import { textOf } from "../src/utils.js";

const resolver = mapResolver({});

function process(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, { resolver });

  return processor.runSync(processor.parse(markdown));
}

function processStandalone(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianFootnotes);

  return processor.runSync(processor.parse(markdown));
}

/** The Footnote node of the first paragraph of a Note. */
function footnoteOf(tree: Root): Parent & { value?: string } {
  const paragraph = tree.children[0] as Paragraph;

  return paragraph.children[1] as Parent & { value?: string };
}

describe("Inline Footnotes", () => {
  it("turns ^[text] into a sup element", () => {
    const tree = process("Note^[details]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "details", data: { hName: "sup" } },
      ],
    });
  });

  it("parses a footnote's content as inline Markdown", () => {
    const tree = process("Note^[*em* **strong** `code`]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        {
          type: "obsidianFootnote",
          value: "*em* **strong** `code`",
          data: { hName: "sup", hProperties: {} },
          children: [
            { type: "emphasis", children: [{ type: "text", value: "em" }] },
            { type: "text", value: " " },
            { type: "strong", children: [{ type: "text", value: "strong" }] },
            { type: "text", value: " " },
            { type: "inlineCode", value: "code" },
          ],
        },
      ],
    });
  });

  it("publishes a plain footnote as a text node without a position", () => {
    const tree = process("Note^[details]");

    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "details",
      data: { hName: "sup" },
    });
  });

  it("publishes an empty footnote as an empty text node", () => {
    const tree = process("Note^[]");

    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "",
      data: { hName: "sup" },
    });
  });

  it("points the parsed children at the footnote's content range", () => {
    const tree = process("Note^[*em*]");
    const emphasis = footnoteOf(tree).children?.[0] as Emphasis;
    const range = {
      start: { line: 1, column: 7, offset: 6 },
      end: { line: 1, column: 11, offset: 10 },
    };

    expect(emphasis.position).toEqual(range);
    expect(emphasis.children?.[0]?.position).toEqual(range);
  });

  it("keeps a footnote that holds elements a container instead of raw text", () => {
    const tree = process("Note^[*em*]");
    const footnote = footnoteOf(tree);

    expect(footnote.type).toBe("obsidianFootnote");
    expect(footnote.children).toHaveLength(1);
    expect(footnote.value).toBe("*em*");
  });

  it("keeps content that reads as block Markdown literal", () => {
    const tree = process("Note^[# heading] and more^[- item]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "# heading", data: { hName: "sup" } },
        { type: "text", value: " and more" },
        { type: "text", value: "- item", data: { hName: "sup" } },
      ],
    });
  });

  it("keeps the raw content of a footnote that holds elements", () => {
    const tree = process("## Heading^[*em*]");
    const heading = tree.children[0] as Heading;

    expect(footnoteOf(tree).value).toBe("*em*");
    expect(textOf(heading)).toBe("Heading*em*");
  });

  it("keeps a bracketed fragment inside the sup", () => {
    const tree = process("Note^[a [1] b]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "a [1] b", data: { hName: "sup" } },
      ],
    });
  });

  it("keeps a Wiki Link inside the sup without resolving it", () => {
    const tree = process("Note^[[[target|alias]]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "[[target|alias]]", data: { hName: "sup" } },
      ],
    });
  });

  it("leaves an unclosed footnote as literal text", () => {
    const tree = process("Note^[unclosed");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Note^[unclosed" }],
    });
    expect(JSON.stringify(tree)).not.toContain('"hName":"sup"');
  });

  it("leaves a footnote spanning a line break as literal text", () => {
    const tree = process("Note^[across\nlines]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Note^[across\nlines]" }],
    });
    expect(JSON.stringify(tree)).not.toContain('"hName":"sup"');
  });

  it("does not add a footnote section", () => {
    const tree = process("One^[first] and two^[second]");

    expect(tree.children).toHaveLength(1);
    expect(JSON.stringify(tree).match(/"hName":"sup"/g) ?? []).toHaveLength(2);
  });

  it("leaves footnotes inside code alone", () => {
    const tree = process("`^[inline]`\n\n```\n^[block]\n```");

    expect(JSON.stringify(tree)).not.toContain('"sup"');
  });

  it("transforms footnotes through the per-feature plugin", () => {
    const tree = processStandalone("Note^[details]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "details", data: { hName: "sup" } },
      ],
    });
  });
});
