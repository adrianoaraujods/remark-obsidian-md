import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import type { RemarkObsidianMdOptions } from "../src/types.js";

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md", title: "Wiki Link" },
  Nested: { path: "/folder/Nested.md" },
});

function process(
  markdown: string,
  options: RemarkObsidianMdOptions = {},
): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, { resolver, ...options });

  return processor.runSync(processor.parse(markdown));
}

describe("remarkObsidianMd", () => {
  it("turns a basic Wiki Link into a link to the Note's URL", () => {
    const tree = process("[[Wiki Link]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/wiki-link",
          children: [{ type: "text", value: "Wiki Link" }],
        },
      ],
    });
  });

  it("honours slugify and urlPrefix when generating the URL", () => {
    const tree = process("[[Nested]]", {
      slugify: (text) => text.toUpperCase(),
      urlPrefix: "/docs",
    });

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "link", url: "/docs/FOLDER/NESTED" }],
    });
  });

  it("marks an unresolved Wiki Link with the is-unresolved class", () => {
    const tree = process("[[Does Not Exist]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "Does Not Exist" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("renders an unresolved Wiki Link as plain text with the plain strategy", () => {
    const tree = process("[[Does Not Exist]]", {
      wikiLinks: { unresolvedStrategy: "plain" },
    });

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Does Not Exist" }],
    });
  });

  it("resolves Wiki Links in every phrasing context", () => {
    const tree = process(
      [
        "# Heading with [[Wiki Link]]",
        "",
        "**[[Wiki Link]]** and _[[Wiki Link]]_",
        "",
        "- [[Wiki Link]]",
      ].join("\n"),
    );

    const links = JSON.stringify(tree).match(/\/wiki-link/g) ?? [];
    expect(links).toHaveLength(4);
  });

  it("leaves Wiki Links inside code alone", () => {
    const tree = process("`[[Wiki Link]]`\n\n```\n[[Wiki Link]]\n```");

    expect(JSON.stringify(tree)).not.toContain("/wiki-link");
  });

  it("leaves aliases and Subpaths literal until later tickets handle them", () => {
    const tree = process("[[Wiki Link|Alias]] and [[Nested#Heading]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "[[Wiki Link|Alias]]" },
        { type: "text", value: " and " },
        { type: "text", value: "[[Nested#Heading]]" },
      ],
    });
  });

  it("uses the injected Resolver for every lookup", () => {
    const injected = mapResolver({ Other: { path: "/Other.md" } });
    const tree = process("[[Other]] [[Wiki Link]]", { resolver: injected });

    expect(tree).toMatchObject({
      children: [
        {
          children: [
            { type: "link", url: "/other" },
            { type: "text", value: " " },
            {
              type: "link",
              url: "#",
              data: { hProperties: { className: "is-unresolved" } },
            },
          ],
        },
      ],
    });
  });
});
