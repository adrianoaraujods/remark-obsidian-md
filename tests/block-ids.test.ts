import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import remarkObsidianMd, { remarkObsidianBlockIds } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import type { RemarkObsidianMdOptions } from "../src/types.js";

const notes: Record<string, string> = {
  "/Other.md": "A block in another Note ^block-2",
  "/Empty.md": "No blocks here",
};

const resolver = mapResolver({
  Other: { path: "/Other.md" },
  Empty: { path: "/Empty.md" },
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
    .use(remarkObsidianMd, { resolver, blockIds: { readNote }, ...options });

  return processor.runSync(processor.parse(markdown));
}

describe("Block IDs", () => {
  it("strips a trailing Block ID from the paragraph and annotates the block", () => {
    const tree = process("A paragraph with a block ^block-1");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "A paragraph with a block" }],
      data: { hProperties: { id: "^block-1" } },
    });
  });

  it("links a same-Note Block Reference to the current Note's Block", () => {
    const tree = process("See [[#^block-1]] and the block ^block-1");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "See " },
        {
          type: "link",
          url: "#^block-1",
          children: [{ type: "text", value: "^block-1" }],
        },
        { type: "text", value: " and the block" },
      ],
    });
    expect(tree.children[0]?.data).toMatchObject({
      hProperties: { id: "^block-1" },
    });
  });

  it("links a Block Reference to another Note's Block", () => {
    const tree = process("See [[Other#^block-2]]");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "See " },
        {
          type: "link",
          url: "/other#^block-2",
          children: [{ type: "text", value: "Other" }],
        },
      ],
    });
  });

  it("does not mistake caret-words in prose for Block IDs", () => {
    const tree = process("Two to the tenth is 2^10 and a^b stays put.");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "Two to the tenth is 2^10 and a^b stays put." },
      ],
    });
    expect(tree.children[0]?.data).toBeUndefined();
  });

  it("never auto-generates Block IDs", () => {
    const tree = process("Just a paragraph.");

    expect(JSON.stringify(tree)).not.toContain('"id"');
  });

  it("marks a same-Note Block Reference that has no matching Block", () => {
    const tree = process("See [[#^missing]]");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "See " },
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "^missing" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("marks a cross-Note Block Reference when the target Note lacks the Block", () => {
    const tree = process("See [[Empty#^block-9]]");

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "See " },
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "Empty" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("links a cross-Note Block Reference when no reader is configured", () => {
    const tree = process("See [[Empty#^block-9]]", { blockIds: {} });

    expect(tree.children[0]).toMatchObject({
      children: [
        { type: "text", value: "See " },
        { type: "link", url: "/empty#^block-9" },
      ],
    });
  });

  it("annotates a list item's block", () => {
    const tree = process("- one\n- two ^item-2");

    expect(tree.children[0]).toMatchObject({
      type: "list",
      children: [
        { type: "listItem" },
        {
          type: "listItem",
          data: { hProperties: { id: "^item-2" } },
          children: [
            { type: "paragraph", children: [{ type: "text", value: "two" }] },
          ],
        },
      ],
    });
  });
});

describe("remarkObsidianBlockIds", () => {
  it("strips and annotates Block IDs through the per-feature plugin", () => {
    const processor = unified().use(remarkParse).use(remarkObsidianBlockIds);
    const tree = processor.runSync(processor.parse("Standalone ^only"));

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Standalone" }],
      data: { hProperties: { id: "^only" } },
    });
  });
});
