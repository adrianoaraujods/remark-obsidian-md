import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianEmbeds } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import type {
  EmbedsPluginOptions,
  RemarkObsidianMdOptions,
  Resolver,
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
  "/Chain C.md": "Chain C body ![[Chain D]]",
  "/Chain D.md": "Chain D body ![[Chain E]]",
  "/Chain E.md": "Chain E body",
  "/Nested.md": [
    "Intro [[Link]]",
    "",
    "> [!note] Callout body",
    "",
    "==Highlighted==",
  ].join("\n"),
  "/Gallery.md": "![[Image.png]]",
  "/Sections.md": [
    "# Top",
    "Top intro",
    "",
    "## Alpha",
    "Alpha body",
    "",
    "### Alpha Child",
    "Child body",
    "",
    "## Beta",
    "Beta body",
    "",
    "# Next Top",
    "Next body",
  ].join("\n"),
  "/Blocks.md": [
    "Intro paragraph",
    "",
    "Referenced paragraph ^target",
    "",
    "Other paragraph ^other",
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
  "Chain D": { path: "/Chain D.md" },
  "Chain E": { path: "/Chain E.md" },
  Nested: { path: "/Nested.md" },
  Gallery: { path: "/Gallery.md" },
  Sections: { path: "/Sections.md", cssclasses: ["wide"] },
  Blocks: { path: "/Blocks.md", cssclasses: ["wide"] },
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

  it("ignores an Alias on a Note Embed and transcludes the Note", () => {
    const tree = process("![[A|Ignored Alias]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed"] },
      },
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
    expect(json.match(/is-embed-limit/g)).toHaveLength(1);
    expect(json).not.toContain("is-unresolved");
  });

  it("stops transcluding at the depth limit", () => {
    const tree = process("![[Chain A]]", {
      embeds: { readNote, maxDepth: 2 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain("Chain B body");
    expect(json).not.toContain("Chain C body");
    expect(json.match(/is-embed-limit/g)).toHaveLength(1);
    expect(json).not.toContain("is-unresolved");
  });

  it("defaults the depth limit to 4", () => {
    const tree = process("![[Chain A]]");
    const json = JSON.stringify(tree);

    expect(json).toContain("Chain D body");
    expect(json).not.toContain("Chain E body");
    expect(json.match(/is-embed-limit/g)).toHaveLength(1);
    expect(json).not.toContain("is-unresolved");
  });

  it("leaves standard Markdown images alone", () => {
    const tree = process("![alt](image.png)");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "image", url: "image.png", alt: "alt" }],
    });
  });

  it("transforms Wiki Links, Callout bodies and Highlights in transcluded content", () => {
    const tree = process("![[Nested]]");
    const json = JSON.stringify(tree);

    expect(json).toContain('"url":"/link"');
    expect(json).toContain('"hName":"mark"');
    expect(json).toContain('"type":"callout"');
    expect(json).toContain("Callout body");
  });
});

describe("partial Embeds", () => {
  it("transcludes a heading section up to the next same-level heading", () => {
    const tree = process("![[Sections#Alpha]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        {
          type: "heading",
          depth: 2,
          children: [{ type: "text", value: "Alpha" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Alpha body" }],
        },
        {
          type: "heading",
          depth: 3,
          children: [{ type: "text", value: "Alpha Child" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Child body" }],
        },
      ],
    });
  });

  it("ends a section at a higher-level heading", () => {
    const tree = process("![[Sections#Top]]");
    const json = JSON.stringify(tree);

    expect(json).toContain("Top intro");
    expect(json).toContain("Beta body");
    expect(json).not.toContain("Next body");
  });

  it("resolves a nested heading chain to the innermost section", () => {
    const tree = process("![[Sections#Top#Alpha]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        { type: "heading", depth: 2 },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Alpha body" }],
        },
        { type: "heading", depth: 3 },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Child body" }],
        },
      ],
    });
  });

  it("matches heading names case-insensitively", () => {
    const tree = process("![[Sections#alpha]]");

    expect(JSON.stringify(tree)).toContain("Alpha body");
  });

  it("transcludes the AST node carrying a Block ID", () => {
    const tree = process("![[Blocks#^target]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Referenced paragraph" }],
          data: { hProperties: { id: "^target" } },
        },
      ],
    });
  });

  it("renders a missing heading as an unresolved placeholder", () => {
    const tree = process("![[Sections#Does Not Exist]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "is-unresolved"] },
      },
      children: [{ type: "text", value: "Sections" }],
    });
  });

  it("renders a missing Block as an unresolved placeholder", () => {
    const tree = process("![[Blocks#^missing]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "is-unresolved"] },
      },
      children: [{ type: "text", value: "Blocks" }],
    });
  });

  it("uses the whole-Note container and CSS Classes for partial Embeds", () => {
    const block = process("![[Sections#Alpha]]");
    const inline = process("before ![[Blocks#^target]] after");

    expect(block.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "wide"] },
      },
    });
    expect(inline.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "before " },
        {
          type: "embed",
          data: {
            hName: "span",
            hProperties: { className: ["internal-embed", "wide"] },
          },
        },
        { type: "text", value: " after" },
      ],
    });
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

const assets: Record<string, { path: string; ext: string }> = {
  "image.png": { path: "/Image.png", ext: ".png" },
  "folder/photo.jpg": { path: "/folder/Photo.jpg", ext: ".jpg" },
  "clip.mp3": { path: "/Clip.mp3", ext: ".mp3" },
  "clip.mp4": { path: "/Clip.mp4", ext: ".mp4" },
  "doc.pdf": { path: "/Doc.pdf", ext: ".pdf" },
};

const assetResolver: Resolver = {
  resolve(target) {
    const asset = assets[target.toLowerCase()];
    if (asset) return { kind: "asset", exists: true, ...asset };
    return resolver.resolve(target);
  },
};

function processAssets(markdown: string): Root {
  return process(markdown, { resolver: assetResolver });
}

describe("remarkObsidianEmbeds (Assets)", () => {
  it("renders an image Asset as an img carrying the Embed container class", () => {
    const tree = processAssets("![[Image.png]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "image",
          url: "/Image.png",
          alt: "",
          data: { hProperties: { className: ["internal-embed"] } },
        },
      ],
    });
  });

  it("sets the width from a numeric Alias", () => {
    const tree = processAssets("![[Image.png|300]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "image",
          alt: "",
          data: {
            hProperties: {
              className: ["internal-embed"],
              width: 300,
            },
          },
        },
      ],
    });
  });

  it("sets width and height from a WxH Alias", () => {
    const tree = processAssets("![[Image.png|300x200]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "image",
          data: {
            hProperties: {
              className: ["internal-embed"],
              width: 300,
              height: 200,
            },
          },
        },
      ],
    });
  });

  it("uses a non-numeric Alias as alt text", () => {
    const tree = processAssets("![[Image.png|A cat]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "image",
          alt: "A cat",
          data: { hProperties: { className: ["internal-embed"] } },
        },
      ],
    });
  });

  it("preserves a nested Asset path", () => {
    const tree = processAssets("![[folder/Photo.jpg]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "image", url: "/folder/Photo.jpg" }],
    });
  });

  it("renders an audio Asset as an audio leaf", () => {
    const tree = processAssets("![[Clip.mp3]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "audio",
        hProperties: {
          className: ["internal-embed"],
          src: "/Clip.mp3",
          controls: true,
        },
      },
      children: [],
    });
  });

  it("renders a video Asset as a video leaf", () => {
    const tree = processAssets("![[Clip.mp4]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "video",
        hProperties: {
          className: ["internal-embed"],
          src: "/Clip.mp4",
          controls: true,
        },
      },
      children: [],
    });
  });

  it("falls back to a link carrying the Embed container class for an unsupported Asset type", () => {
    const tree = processAssets("![[Doc.pdf]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/Doc.pdf",
          children: [{ type: "text", value: "Doc.pdf" }],
          data: { hProperties: { className: ["internal-embed"] } },
        },
      ],
    });
  });

  it("uses the Alias as the fallback link's label", () => {
    const tree = processAssets("![[Doc.pdf|The doc]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/Doc.pdf",
          children: [{ type: "text", value: "The doc" }],
          data: { hProperties: { className: ["internal-embed"] } },
        },
      ],
    });
  });

  it("renders an unresolved Asset Embed as a marked placeholder", () => {
    const tree = processAssets("![[Missing.png]]");

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      data: {
        hName: "div",
        hProperties: { className: ["internal-embed", "is-unresolved"] },
      },
      children: [{ type: "text", value: "Missing.png" }],
    });
  });

  it("renders an unresolved sized or aliased Asset Embed as a placeholder", () => {
    for (const markdown of ["![[Missing.png|300]]", "![[Missing.png|Alt]]"]) {
      expect(processAssets(markdown).children[0]).toMatchObject({
        type: "embed",
        data: {
          hProperties: { className: ["internal-embed", "is-unresolved"] },
        },
        children: [{ type: "text", value: "Missing.png" }],
      });
    }
  });

  it("resolves Asset Embeds inside transcluded Notes", () => {
    const tree = process("![[Gallery]]", {
      resolver: assetResolver,
      embeds: { readNote: (path) => notes[path] },
    });

    expect(tree.children[0]).toMatchObject({
      type: "embed",
      children: [
        {
          type: "paragraph",
          children: [{ type: "image", url: "/Image.png" }],
        },
      ],
    });
  });
});
