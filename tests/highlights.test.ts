import type { Paragraph, Root, Strong } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianHighlights } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import { textOf } from "../src/utils.js";

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

function processGfm(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
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

/** Every mark element of a tree, with the Highlight Color it carries and its text. */
function marksOf(tree: Root): { highlightColor?: string; text: string }[] {
  const marks: { highlightColor?: string; text: string }[] = [];

  visit(tree, (node) => {
    const data = node.data as
      | { hName?: string; hProperties?: Record<string, string> }
      | undefined;
    if (data?.hName !== "mark") return;

    marks.push({
      highlightColor: data.hProperties?.["data-highlight"],
      text: textOf(node),
    });
  });

  return marks;
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

  it("keeps a plain Highlight free of a Highlight Color attribute", () => {
    const tree = process("==marked==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "marked", data: { hName: "mark" } }],
    });
    expect(JSON.stringify(tree)).not.toContain("data-highlight");
  });

  it("publishes each of the six Highlight Colors", () => {
    const highlightColors = [
      ["🔴", "red"],
      ["🟠", "orange"],
      ["🟡", "yellow"],
      ["🟢", "green"],
      ["🔵", "blue"],
      ["🟣", "purple"],
    ];

    for (const [emoji, highlightColor] of highlightColors) {
      const tree = process(`==${emoji}text==`);

      expect(tree.children[0]).toMatchObject({
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "text",
            data: {
              hName: "mark",
              hProperties: { "data-highlight": highlightColor },
            },
          },
        ],
      });
    }
  });

  it("publishes the square emoji of every Highlight Color", () => {
    const highlightColors = [
      ["🟥", "red"],
      ["🟧", "orange"],
      ["🟨", "yellow"],
      ["🟩", "green"],
      ["🟦", "blue"],
      ["🟪", "purple"],
    ];

    for (const [emoji, highlightColor] of highlightColors) {
      const tree = process(`==${emoji}text==`);

      expect(tree.children[0]).toMatchObject({
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "text",
            data: {
              hName: "mark",
              hProperties: { "data-highlight": highlightColor },
            },
          },
        ],
      });
    }
  });

  it("turns a Highlight with a Highlight Color into a mark element", () => {
    const tree = process("==🔴red==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "red",
          data: { hName: "mark", hProperties: { "data-highlight": "red" } },
        },
      ],
    });
  });

  it("keeps an unsupported emoji inside the highlight as text", () => {
    const tree = process("==🍎red==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "🍎red", data: { hName: "mark" } }],
    });
    expect(JSON.stringify(tree)).not.toContain("data-highlight");
  });

  it("counts only the first emoji as the Highlight Color", () => {
    const tree = process("==🔴🟢x==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "🟢x",
          data: { hName: "mark", hProperties: { "data-highlight": "red" } },
        },
      ],
    });
  });

  it("publishes a Highlight holding only the Highlight Color emoji as an empty mark", () => {
    const tree = process("==🔴==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "",
          data: { hName: "mark", hProperties: { "data-highlight": "red" } },
        },
      ],
    });
  });

  it("keeps the Highlight Color of a Highlight holding elements", () => {
    const tree = process("==🔴red **bold**==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      value: "==🔴red **bold**==",
      data: { hName: "mark", hProperties: { "data-highlight": "red" } },
      children: [
        { type: "text", value: "red " },
        { type: "strong", children: [{ type: "text", value: "bold" }] },
      ],
    });
  });

  it("points the parsed children at the content range behind the Highlight Color emoji", () => {
    const tree = process("==🔴**bold**==");
    const strong = (highlightOf(tree) as { children: Strong[] }).children[0];
    const range = {
      start: { line: 1, column: 5, offset: 4 },
      end: { line: 1, column: 13, offset: 12 },
    };

    expect(strong?.position).toEqual(range);
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

  it("transforms a Highlight with a Highlight Color through the per-feature plugin", () => {
    const tree = processStandalone("==🔴red==");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "red",
          data: { hName: "mark", hProperties: { "data-highlight": "red" } },
        },
      ],
    });
  });

  it("keeps the Highlight Color of a Highlight holding elements through the per-feature plugin", () => {
    const tree = processStandalone("==🔴**bold**==");

    expect(highlightOf(tree)).toMatchObject({
      type: "obsidianHighlight",
      data: { hName: "mark", hProperties: { "data-highlight": "red" } },
      children: [
        { type: "strong", children: [{ type: "text", value: "bold" }] },
      ],
    });
  });

  it("keeps the Highlight Color in every phrasing context", () => {
    const tree = process(
      "# ==🔴heading==\n\n- ==🔴item==\n\n**==🔴strong==** _==🔴em==_",
    );

    expect(marksOf(tree)).toEqual([
      { highlightColor: "red", text: "heading" },
      { highlightColor: "red", text: "item" },
      { highlightColor: "red", text: "strong" },
      { highlightColor: "red", text: "em" },
    ]);
  });

  it("keeps the Highlight Color in a table cell", () => {
    const tree = processGfm("| construct |\n| --------- |\n| ==🔴cell== |");

    expect(marksOf(tree)).toEqual([{ highlightColor: "red", text: "cell" }]);
  });

  it("keeps the Highlight Color in a blockquote and a Callout body", () => {
    const tree = process("> ==🔴quote==\n\n> [!note]\n> ==🔴callout==");

    expect(marksOf(tree)).toEqual([
      { highlightColor: "red", text: "quote" },
      { highlightColor: "red", text: "callout" },
    ]);
  });

  it("keeps the Highlight Color inside a Footnote", () => {
    const tree = process("Note^[==🔴footnote==]");

    expect(marksOf(tree)).toEqual([
      { highlightColor: "red", text: "footnote" },
    ]);
  });

  it("leaves the Highlight Color emoji inside code alone", () => {
    const tree = process("`==🔴inline==`\n\n```\n==🔴block==\n```");

    expect(marksOf(tree)).toEqual([]);
    expect(JSON.stringify(tree)).toContain("🔴");
  });
});
