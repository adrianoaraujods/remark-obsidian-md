import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
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
    .use(remarkGfm)
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
        "",
        "| Link |",
        "| --- |",
        "| [[Wiki Link]] |",
      ].join("\n"),
    );

    const links = JSON.stringify(tree).match(/\/wiki-link/g) ?? [];
    expect(links).toHaveLength(5);
  });

  it("leaves Wiki Links inside code alone", () => {
    const tree = process("`[[Wiki Link]]`\n\n```\n[[Wiki Link]]\n```");

    expect(JSON.stringify(tree)).not.toContain("/wiki-link");
  });

  it("displays the Alias of an aliased Wiki Link", () => {
    const tree = process("[[Wiki Link|Click Here]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/wiki-link",
          children: [{ type: "text", value: "Click Here" }],
        },
      ],
    });
  });

  it("links a heading Subpath to the heading anchor in another Note", () => {
    const tree = process("[[Wiki Link#Some Heading]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/wiki-link#some-heading",
          children: [{ type: "text", value: "Wiki Link" }],
        },
      ],
    });
  });

  it("links a same-Note heading Subpath within the current Note", () => {
    const tree = process("# Some Heading\n\n[[#Some Heading]]");

    expect(tree.children[1]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "#some-heading",
          children: [{ type: "text", value: "Some Heading" }],
        },
      ],
    });
  });

  it("renders a same-Note heading Subpath without a matching heading as unresolved", () => {
    const tree = process("# Some Heading\n\n[[#Missing Heading]]");

    expect(tree.children[1]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "Missing Heading" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("combines a Subpath with an Alias", () => {
    const tree = process("[[Wiki Link#Some Heading|Click Here]]");

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          type: "link",
          url: "/wiki-link#some-heading",
          children: [{ type: "text", value: "Click Here" }],
        },
      ],
    });
  });

  it("uses the Alias as the label of an unresolved Wiki Link", () => {
    const tree = process("[[Does Not Exist|Click Here]]");

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "Click Here" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("resolves a nested heading chain to the innermost heading", () => {
    const tree = process(
      "# A\n\n## B\n\n[[Nested#First Heading#Second Heading]] and [[#A#B]]",
    );

    expect(tree.children[2]).toMatchObject({
      children: [
        { type: "link", url: "/folder/nested#second-heading" },
        { type: "text", value: " and " },
        {
          type: "link",
          url: "#b",
          children: [{ type: "text", value: "B" }],
        },
      ],
    });
  });

  it("uses a configurable anchor slugger, defaulting to GitHub-style slugs", () => {
    const markdown = "[[Wiki Link#Some Heading!]]";

    expect(process(markdown).children[0]).toMatchObject({
      children: [{ type: "link", url: "/wiki-link#some-heading" }],
    });
    expect(
      process(markdown, { slugger: (text) => text.toUpperCase() }).children[0],
    ).toMatchObject({
      children: [{ type: "link", url: "/wiki-link#SOME HEADING!" }],
    });
  });

  it("parses an escaped pipe inside a table cell as an Alias", () => {
    const tree = process("| Link |\n| --- |\n| [[Wiki Link\\|Click Here]] |");

    expect(tree.children[0]).toMatchObject({
      type: "table",
      children: [
        {
          type: "tableRow",
          children: [{ type: "tableCell", children: [{ type: "text" }] }],
        },
        {
          type: "tableRow",
          children: [
            {
              type: "tableCell",
              children: [
                {
                  type: "link",
                  url: "/wiki-link",
                  children: [{ type: "text", value: "Click Here" }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("renders a Wiki Link inside standard link text literally", () => {
    const tree = process("[see [[Wiki Link]]](https://example.com)");
    const [link] = tree.children[0].children;

    expect(link).toMatchObject({ type: "link", url: "https://example.com" });
    expect(
      link?.type === "link" &&
        link.children.every((child) => child.type === "text"),
    ).toBe(true);
    expect(JSON.stringify(link)).toContain("[[Wiki Link]]");
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

describe("Subpath validation", () => {
  const bodies: Record<string, string> = {
    "/Wiki Link.md": "Intro\n\n# Real Heading\n\nBody",
  };

  const readNote = (path: string): string | undefined => bodies[path];

  it("marks a cross-Note heading Subpath unresolved when the target lacks the heading", () => {
    const tree = process("[[Wiki Link#No Such Heading]]", {
      embeds: { readNote },
    });

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: "Wiki Link" }],
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });

  it("links a cross-Note heading Subpath when the target has the heading", () => {
    const tree = process("[[Wiki Link#Real Heading]]", {
      embeds: { readNote },
    });

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          type: "link",
          url: "/wiki-link#real-heading",
          children: [{ type: "text", value: "Wiki Link" }],
        },
      ],
    });
  });

  it("keeps a cross-Note heading Subpath when no reader is configured", () => {
    const tree = process("[[Wiki Link#Any Heading]]");

    expect(tree.children[0]).toMatchObject({
      children: [{ type: "link", url: "/wiki-link#any-heading" }],
    });
  });

  it("validates a same-Note heading Subpath against the current Note", () => {
    const tree = process("# Real Heading\n\n[[#Real Heading]] [[#Missing]]");

    expect(tree.children[1]).toMatchObject({
      children: [
        { type: "link", url: "#real-heading" },
        { type: "text", value: " " },
        {
          type: "link",
          url: "#",
          data: { hProperties: { className: "is-unresolved" } },
        },
      ],
    });
  });
});
