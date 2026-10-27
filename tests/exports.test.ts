import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, {
  createSlugifyPath,
  filesystemResolver,
  getFrontmatter,
  mapResolver,
  remarkObsidianBlockIds,
  remarkObsidianCallouts,
  remarkObsidianComments,
  remarkObsidianEmbeds,
  remarkObsidianFootnotes,
  remarkObsidianHighlights,
  remarkObsidianWikiLinks,
  slugify,
} from "../src/index.js";

function run(plugin: unknown, markdown: string, options = {}): Root {
  const processor = unified()
    .use(remarkParse)
    // biome-ignore lint/suspicious/noExplicitAny: plugin union loses `this` typing
    .use(plugin as any, options);

  return processor.runSync(processor.parse(markdown));
}

describe("package exports", () => {
  it("remarkObsidianWikiLinks resolves a Wiki Link", () => {
    const tree = run(remarkObsidianWikiLinks, "[[Target]]", {
      resolver: mapResolver({ Target: { path: "/Target.md" } }),
    });

    expect(tree.children[0]).toMatchObject({
      children: [{ type: "link", url: "/target" }],
    });
  });

  it("remarkObsidianEmbeds transcludes a Note", () => {
    const tree = run(remarkObsidianEmbeds, "![[Target]]", {
      resolver: mapResolver({ Target: { path: "/Target.md" } }),
      readNote: () => "Embedded body",
    });

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: { hName: "div", hProperties: { className: ["internal-embed"] } },
      children: [{ type: "paragraph", children: [{ value: "Embedded body" }] }],
    });
  });

  it("remarkObsidianHighlights turns ==text== into a mark", () => {
    const tree = run(remarkObsidianHighlights, "==marked==");

    expect(tree.children[0]).toMatchObject({
      children: [{ type: "text", value: "marked", data: { hName: "mark" } }],
    });
  });

  it("remarkObsidianCallouts renders a Callout", () => {
    const tree = run(remarkObsidianCallouts, "> [!note]");

    expect(tree.children[0]).toMatchObject({
      type: "callout",
      data: {
        hName: "div",
        hProperties: { className: ["callout"], "data-callout": "note" },
      },
    });
  });

  it("remarkObsidianComments removes an inline Comment", () => {
    const tree = run(remarkObsidianComments, "keep %%drop%% kept");

    expect(JSON.stringify(tree)).not.toContain("drop");
    expect(JSON.stringify(tree)).toContain("keep");
    expect(JSON.stringify(tree)).toContain(" kept");
  });

  it("remarkObsidianBlockIds strips and annotates a Block ID", () => {
    const tree = run(remarkObsidianBlockIds, "Paragraph body ^block-id");

    expect(tree.children[0]).toMatchObject({
      children: [{ type: "text", value: "Paragraph body" }],
      data: { hProperties: { id: "^block-id" } },
    });
  });

  it("remarkObsidianFootnotes turns ^[text] into a sup", () => {
    const tree = run(remarkObsidianFootnotes, "Note^[details]");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "Note" },
        { type: "text", value: "details", data: { hName: "sup" } },
      ],
    });
  });

  it("exports the composed plugin as default and named remarkObsidianMd", () => {
    expect(remarkObsidianMd.name).toBe("remarkObsidianMd");

    const tree = run(remarkObsidianMd, "[[Target]] ==marked==", {
      resolver: mapResolver({ Target: { path: "/Target.md" } }),
    });

    expect(JSON.stringify(tree)).toContain('{"type":"link","url":"/target"');
    expect(JSON.stringify(tree)).toContain('"hName":"mark"');
  });

  it("exports the helpers", () => {
    expect(slugify("Some Note")).toBe("some-note");
    expect(mapResolver({ A: { path: "/A.md" } }).resolve("a")).toMatchObject({
      kind: "note",
      exists: true,
    });
    expect(
      filesystemResolver("tests/fixtures").resolve("does-not-exist"),
    ).toEqual({ kind: "note", exists: false });
    expect(createSlugifyPath(["/A.md", "/B.md"])("/A.md")).toBe("a");
    expect(
      getFrontmatter(
        { related: "[[Target]]" },
        {
          resolver: mapResolver({ Target: { path: "/Target.md" } }),
        },
      ),
    ).toEqual({ related: { url: "/target", label: "Target" } });
  });
});
