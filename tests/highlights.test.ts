import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianHighlights } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";

const resolver = mapResolver({});

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

  it("does not transform highlight colors", () => {
    const tree = process("==🔴red==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "==🔴red==" }],
    });
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
});
