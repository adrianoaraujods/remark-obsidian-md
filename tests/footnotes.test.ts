import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianFootnotes } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";

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
