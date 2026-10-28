import type { Emphasis, Heading, Paragraph, Parent, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, {
  remarkObsidianFootnotes,
  remarkObsidianHighlights,
} from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import { githubSlugger, textOf } from "../src/utils.js";

const notes: Record<string, string> = {
  "/Other.md": "A block in another Note ^block-2",
  "/Embedded.md": "Embedded body^[[[Note|Alias]]]",
};

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md", aliases: ["Alias Note"] },
  Note: { path: "/Note.md" },
  Other: { path: "/Other.md" },
  Embedded: { path: "/Embedded.md" },
});

/** A `[[Note|Alias]]` Wiki Link, resolved. */
const resolvedAlias = {
  type: "link",
  url: "/note",
  children: [{ type: "text", value: "Alias" }],
};

function readNote(path: string): string | undefined {
  return notes[path];
}

function process(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianMd, {
    resolver,
    embeds: { readNote },
    blockIds: { readNote },
  });

  return processor.runSync(processor.parse(markdown));
}

function processStandalone(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianFootnotes);

  return processor.runSync(processor.parse(markdown));
}

/** Highlights and Footnotes composed by hand, like a user would. */
function processHighlightsFootnotes(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianHighlights)
    .use(remarkObsidianFootnotes);

  return processor.runSync(processor.parse(markdown));
}

function processGfm(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkObsidianMd, {
      resolver,
      embeds: { readNote },
      blockIds: { readNote },
    });

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

  it("parses a footnote's indented content as inline Markdown", () => {
    const tree = process("Note^[   *em*]");
    const footnote = footnoteOf(tree);

    expect(footnote.type).toBe("obsidianFootnote");
    expect(footnote.children).toMatchObject([
      { type: "emphasis", children: [{ type: "text", value: "em" }] },
    ]);
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

  it("resolves a Wiki Link inside a footnote", () => {
    const tree = process("Note^[[[Wiki Link]]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        {
          type: "obsidianFootnote",
          value: "[[Wiki Link]]",
          data: { hName: "sup", hProperties: {} },
          children: [
            {
              type: "link",
              url: "/wiki-link",
              children: [{ type: "text", value: "Wiki Link" }],
            },
          ],
        },
      ],
    });
  });

  it("shows the Alias of a Wiki Link inside a footnote", () => {
    const tree = process("Note^[[[Wiki Link|Click Here]]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "/wiki-link",
        children: [{ type: "text", value: "Click Here" }],
      },
    ]);
  });

  it("resolves a heading Subpath inside a footnote", () => {
    const tree = process("Note^[[[Wiki Link#Some Heading]]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "/wiki-link#some-heading",
        children: [{ type: "text", value: "Wiki Link" }],
      },
    ]);
  });

  it("resolves a Block Reference inside a footnote", () => {
    const tree = process("Note^[[[Other#^block-2]]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "/other#^block-2",
        children: [{ type: "text", value: "Other" }],
      },
    ]);
  });

  it("resolves a heading of the same Note inside a footnote", () => {
    const tree = process("# Heading\n\nNote^[[[#Heading]]]");
    const paragraph = tree.children[1] as Paragraph;

    expect(paragraph.children[1]).toMatchObject({
      type: "obsidianFootnote",
      children: [
        {
          type: "link",
          url: "#heading",
          children: [{ type: "text", value: "Heading" }],
        },
      ],
    });
  });

  it("resolves several Wiki Links and text in one footnote", () => {
    const tree = process("Note^[[[Wiki Link]] and [[Other]]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "/wiki-link",
        children: [{ type: "text", value: "Wiki Link" }],
      },
      { type: "text", value: " and " },
      {
        type: "link",
        url: "/other",
        children: [{ type: "text", value: "Other" }],
      },
    ]);
  });

  it("marks an unresolved Wiki Link inside a footnote", () => {
    const tree = process("Note^[[[Missing]]]");
    const body = process("[[Missing]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "#",
        children: [{ type: "text", value: "Missing" }],
        data: { hProperties: { className: "is-unresolved" } },
      },
    ]);
    expect((body.children[0] as Paragraph).children[0]).toMatchObject(
      footnoteOf(tree).children?.[0],
    );
  });

  it("turns a Highlight inside a footnote into a mark element", () => {
    const tree = process("Note^[==highlight==]");

    expect(footnoteOf(tree).children).toMatchObject([
      { type: "text", value: "highlight", data: { hName: "mark" } },
    ]);
  });

  it("removes a Comment inside a footnote", () => {
    const tree = process("Note^[%%comment%%]");

    expect(footnoteOf(tree).type).toBe("obsidianFootnote");
    expect(footnoteOf(tree).children).toEqual([]);
    expect(footnoteOf(tree).data).toEqual({ hName: "sup", hProperties: {} });
  });

  it("never nests a footnote inside another footnote", () => {
    const tree = process("Note^[a ^[b] c]");

    expect(JSON.stringify(tree).match(/"hName":"sup"/g) ?? []).toHaveLength(1);
    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "a ^[b] c",
      data: { hName: "sup" },
    });
  });

  it("keeps an Embed inside a footnote literal", () => {
    const tree = process("Note^[![[Wiki Link]]]");

    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "![[Wiki Link]]",
      data: { hName: "sup" },
    });
  });

  it("resolves a Note by its Alias inside a footnote", () => {
    const tree = process("Note^[[[Alias Note]]]");

    expect(footnoteOf(tree).children).toMatchObject([
      {
        type: "link",
        url: "/wiki-link",
        children: [{ type: "text", value: "Alias Note" }],
      },
    ]);
  });

  it("honours the extensions the pipeline carries inside a footnote", () => {
    const tree = processGfm("Note^[~~struck~~]");

    expect(footnoteOf(tree).children).toMatchObject([
      { type: "delete", children: [{ type: "text", value: "struck" }] },
    ]);
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

    expect(tree.children).toMatchObject([
      {
        type: "paragraph",
        children: [{ type: "inlineCode", value: "^[inline]" }],
      },
      { type: "code", value: "^[block]" },
    ]);
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

  it("parses a footnote's content as inline Markdown through the per-feature plugin", () => {
    const tree = processStandalone("Note^[*em*]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        {
          type: "obsidianFootnote",
          value: "*em*",
          data: { hName: "sup", hProperties: {} },
          children: [
            { type: "emphasis", children: [{ type: "text", value: "em" }] },
          ],
        },
      ],
    });
  });

  it("resolves only the syntax the pipeline provides through the per-feature plugin", () => {
    const tree = processStandalone("Note^[[[Wiki Link]]]");

    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "[[Wiki Link]]",
      data: { hName: "sup" },
    });
  });
});

describe("Footnotes in phrasing contexts", () => {
  it("resolves a Wiki Link inside a footnote in a table cell", () => {
    const tree = processGfm(
      "| head | head |\n| --- | --- |\n| x | ^[see [[Note\\|Alias]]] |",
    );

    expect(tree.children[0]).toMatchObject({
      type: "table",
      children: [
        {
          type: "tableRow",
          children: [
            { type: "tableCell", children: [{ type: "text", value: "head" }] },
            { type: "tableCell", children: [{ type: "text", value: "head" }] },
          ],
        },
        {
          type: "tableRow",
          children: [
            { type: "tableCell", children: [{ type: "text", value: "x" }] },
            {
              type: "tableCell",
              children: [
                {
                  type: "obsidianFootnote",
                  value: "see [[Note\\|Alias]]",
                  data: { hName: "sup", hProperties: {} },
                  children: [{ type: "text", value: "see " }, resolvedAlias],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in a Callout body", () => {
    const tree = process("> [!note] Title\n> body^[[[Note|Alias]]]");

    expect(tree.children[0]).toMatchObject({
      type: "callout",
      children: [
        { type: "calloutPart" },
        {
          type: "calloutPart",
          data: { hProperties: { className: ["callout-content"] } },
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", value: "body" },
                { type: "obsidianFootnote", children: [resolvedAlias] },
              ],
            },
          ],
        },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in a list item", () => {
    const tree = process("- item^[[[Note|Alias]]]");

    expect(tree.children[0]).toMatchObject({
      type: "list",
      children: [
        {
          type: "listItem",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", value: "item" },
                { type: "obsidianFootnote", children: [resolvedAlias] },
              ],
            },
          ],
        },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in a heading", () => {
    const tree = process("# Heading^[[[Note|Alias]]]");

    expect(tree.children[0]).toMatchObject({
      type: "heading",
      depth: 1,
      children: [
        { type: "text", value: "Heading" },
        { type: "obsidianFootnote", children: [resolvedAlias] },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in emphasis", () => {
    const tree = process("*em^[[[Note|Alias]]]*");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "emphasis",
          children: [
            { type: "text", value: "em" },
            { type: "obsidianFootnote", children: [resolvedAlias] },
          ],
        },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in strong text", () => {
    const tree = process("**strong^[[[Note|Alias]]]**");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "strong",
          children: [
            { type: "text", value: "strong" },
            { type: "obsidianFootnote", children: [resolvedAlias] },
          ],
        },
      ],
    });
  });

  it("resolves a Wiki Link inside a footnote in an embedded Note", () => {
    const tree = process("![[Embedded]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Embedded body" },
            { type: "obsidianFootnote", children: [resolvedAlias] },
          ],
        },
      ],
    });
  });

  it("keeps the anchor of a heading carrying a footnote", () => {
    const tree = process("# Heading^[[[Note]]]");
    const heading = tree.children[0] as Heading;

    expect(textOf(heading)).toBe("Heading[[Note]]");
    expect(githubSlugger(textOf(heading))).toBe("headingnote");
  });

  it("keeps an inline Embed whose embedded Note carries a footnote in a phrasing container", () => {
    const tree = process("*![[Embedded]]*");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "emphasis",
          children: [
            {
              type: "embed",
              data: {
                hName: "span",
                hProperties: { className: ["internal-embed"] },
              },
              children: [
                {
                  type: "paragraph",
                  children: [
                    { type: "text", value: "Embedded body" },
                    { type: "obsidianFootnote", children: [resolvedAlias] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});

describe("Highlight Colors in Footnotes", () => {
  it("keeps the Highlight Color of a Highlight inside a Footnote", () => {
    const tree = process("Note^[==🔴watch this==]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Note" },
        {
          type: "obsidianFootnote",
          value: "==🔴watch this==",
          data: { hName: "sup", hProperties: {} },
          children: [
            {
              type: "text",
              value: "watch this",
              data: {
                hName: "mark",
                hProperties: { "data-highlight": "red" },
              },
            },
          ],
        },
      ],
    });
  });

  it("keeps the Highlight Color and the inline Markdown of a Highlight inside a Footnote", () => {
    const tree = process("Note^[==🔴*em* [[Wiki Link]]==]");

    expect(footnoteOf(tree)).toMatchObject({
      type: "obsidianFootnote",
      value: "==🔴*em* [[Wiki Link]]==",
      children: [
        {
          type: "obsidianHighlight",
          value: "==🔴*em* [[Wiki Link]]==",
          data: {
            hName: "mark",
            hProperties: { "data-highlight": "red" },
          },
          children: [
            { type: "emphasis", children: [{ type: "text", value: "em" }] },
            { type: "text", value: " " },
            {
              type: "link",
              url: "/wiki-link",
              children: [{ type: "text", value: "Wiki Link" }],
            },
          ],
        },
      ],
    });
  });

  it("points the Footnote's content at the range the color marker did not shift", () => {
    const tree = process("Note^[==🔴*em*==]");
    const highlight = footnoteOf(tree).children?.[0] as Emphasis;
    const range = {
      start: { line: 1, column: 7, offset: 6 },
      end: { line: 1, column: 17, offset: 16 },
    };

    expect(highlight.position).toEqual(range);
    expect(highlight.children?.[0]?.position).toEqual(range);
  });

  it("publishes a Footnote without a color unchanged", () => {
    const tree = process("Note^[plain footnote]");

    expect(footnoteOf(tree)).toEqual({
      type: "text",
      value: "plain footnote",
      data: { hName: "sup" },
    });
  });

  it("keeps the Highlight Color through the per-feature plugins", () => {
    const tree = processHighlightsFootnotes("Note^[==🔴watch this==]");

    expect(footnoteOf(tree)).toMatchObject({
      type: "obsidianFootnote",
      children: [
        {
          type: "text",
          value: "watch this",
          data: {
            hName: "mark",
            hProperties: { "data-highlight": "red" },
          },
        },
      ],
    });
  });
});
