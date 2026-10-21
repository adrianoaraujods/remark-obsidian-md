/** biome-ignore-all lint/suspicious/noExplicitAny: custom Callout nodes are asserted structurally */

import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianCallouts } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";
import type { RemarkObsidianMdOptions } from "../src/types.js";

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md", title: "Wiki Link" },
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

describe("Callouts", () => {
  it("renders a non-foldable callout with the default title derived from the type", () => {
    const tree = process("> [!note]");

    expect(tree.children[0]).toMatchObject({
      type: "callout",
      data: {
        hName: "div",
        hProperties: {
          className: ["callout"],
          "data-callout": "note",
        },
      },
      children: [
        {
          data: {
            hName: "div",
            hProperties: { className: ["callout-title"] },
          },
          children: [
            {
              data: {
                hName: "span",
                hProperties: {
                  className: ["callout-title-icon"],
                  "data-icon": "pencil",
                },
              },
            },
            {
              data: {
                hName: "div",
                hProperties: { className: ["callout-title-inner"] },
              },
              children: [{ type: "text", value: "Note" }],
            },
          ],
        },
        {
          data: {
            hName: "div",
            hProperties: { className: ["callout-content"] },
          },
          children: [],
        },
      ],
    });
  });

  it("renders a custom title written after the type", () => {
    const tree = process("> [!note] My own title\n> Body");

    const callout = tree.children[0] as any;
    const titleInner = callout.children[0].children[1];

    expect(titleInner.children).toMatchObject([
      { type: "text", value: "My own title" },
    ]);
    expect(callout.children[1].children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "Body" }] },
    ]);
  });

  it("renders the canonical 13 types with their icons and default titles", () => {
    const types: Array<[string, string, string]> = [
      ["note", "pencil", "Note"],
      ["abstract", "clipboard-list", "Abstract"],
      ["info", "info", "Info"],
      ["todo", "check-circle-2", "Todo"],
      ["tip", "flame", "Tip"],
      ["success", "check", "Success"],
      ["question", "help-circle", "Question"],
      ["warning", "alert-triangle", "Warning"],
      ["failure", "x", "Failure"],
      ["danger", "zap", "Danger"],
      ["bug", "bug", "Bug"],
      ["example", "list", "Example"],
      ["quote", "quote", "Quote"],
    ];

    for (const [type, icon, title] of types) {
      const callout = process(`> [!${type}]`).children[0] as any;

      expect(callout.data.hProperties["data-callout"]).toBe(type);
      expect(
        callout.children[0].children[0].data.hProperties["data-icon"],
      ).toBe(icon);
      expect(callout.children[0].children[1].children).toMatchObject([
        { type: "text", value: title },
      ]);
    }
  });

  it("resolves aliases to their canonical type", () => {
    const aliases: Array<[string, string]> = [
      ["summary", "abstract"],
      ["tldr", "abstract"],
      ["hint", "tip"],
      ["important", "tip"],
      ["check", "success"],
      ["done", "success"],
      ["help", "question"],
      ["faq", "question"],
      ["caution", "warning"],
      ["attention", "warning"],
      ["fail", "failure"],
      ["missing", "failure"],
      ["error", "danger"],
      ["cite", "quote"],
    ];

    for (const [alias, type] of aliases) {
      const callout = process(`> [!${alias}]`).children[0] as any;

      expect(callout.data.hProperties["data-callout"]).toBe(type);
      expect(callout.children[0].children[1].children).toMatchObject([
        { type: "text", value: alias[0]?.toUpperCase() + alias.slice(1) },
      ]);
    }
  });

  it("falls back to note for an unknown type", () => {
    const callout = process("> [!nonsense]").children[0] as any;

    expect(callout.data.hProperties["data-callout"]).toBe("note");
    expect(callout.children[0].children[0].data.hProperties["data-icon"]).toBe(
      "pencil",
    );
    expect(callout.children[0].children[1].children).toMatchObject([
      { type: "text", value: "Nonsense" },
    ]);
  });

  it("registers custom types via options", () => {
    const callout = process("> [!secret]", {
      callouts: {
        types: {
          secret: { icon: "lock", color: "#ff0000", title: "Classified" },
        },
      },
    }).children[0] as any;

    expect(callout.data.hProperties).toMatchObject({
      "data-callout": "secret",
      style: "--callout-color: #ff0000",
    });
    expect(callout.children[0].children[0].data.hProperties["data-icon"]).toBe(
      "lock",
    );
    expect(callout.children[0].children[1].children).toMatchObject([
      { type: "text", value: "Classified" },
    ]);
  });

  it("renders a collapsed callout as details without open", () => {
    const callout = process("> [!faq]-").children[0] as any;

    expect(callout.data.hName).toBe("details");
    expect(callout.data.hProperties).toMatchObject({
      className: ["callout", "is-collapsible"],
      "data-callout": "question",
    });
    expect(callout.data.hProperties.open).toBeUndefined();
    expect(callout.children[0].data).toMatchObject({
      hName: "summary",
      hProperties: { className: ["callout-title"] },
    });
  });

  it("renders an expanded callout as details with open", () => {
    const callout = process("> [!faq]+").children[0] as any;

    expect(callout.data.hName).toBe("details");
    expect(callout.data.hProperties).toMatchObject({
      className: ["callout", "is-collapsible"],
      open: true,
    });
  });

  it("renders nested Callouts nested", () => {
    const callout = process(
      ["> [!note] Outer", "> > [!tip] Inner", "> > Inner body"].join("\n"),
    ).children[0] as any;

    const nested = callout.children[1].children[0];

    expect(nested).toMatchObject({
      type: "callout",
      data: {
        hName: "div",
        hProperties: { className: ["callout"], "data-callout": "tip" },
      },
    });
    expect(nested.children[1].children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "Inner body" }] },
    ]);
  });

  it("supports markdown, Wiki Links and tables in the body", () => {
    const callout = process(
      [
        "> [!note] Body",
        "> At **bold** text and [[Wiki Link]]",
        ">",
        "> | Key | Link |",
        "> | --- | --- |",
        "> | a | [[Wiki Link]] |",
      ].join("\n"),
    ).children[0] as any;

    const body = callout.children[1].children;

    expect(body[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "At " },
        { type: "strong" },
        { type: "text", value: " text and " },
        { type: "link", url: "/wiki-link" },
      ],
    });
    expect(body[1]).toMatchObject({
      type: "table",
      children: [
        {},
        {
          type: "tableRow",
          children: [
            { type: "tableCell" },
            {
              type: "tableCell",
              children: [{ type: "link", url: "/wiki-link" }],
            },
          ],
        },
      ],
    });
  });

  it("is available as a standalone plugin", () => {
    const processor = unified().use(remarkParse).use(remarkObsidianCallouts);

    const tree = processor.runSync(processor.parse("> [!tip] Standalone"));

    expect(tree.children[0]).toMatchObject({
      type: "callout",
      data: { hProperties: { "data-callout": "tip" } },
    });
  });
});
