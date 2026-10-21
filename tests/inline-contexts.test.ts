import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd from "../src/index.js";
import { mapResolver } from "../src/resolver.js";

const resolver = mapResolver({});

function process(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkObsidianMd, { resolver });

  return processor.runSync(processor.parse(markdown));
}

describe("inline constructs in phrasing contexts", () => {
  it("transforms highlights, comments and footnotes in table cells", () => {
    const tree = process(
      [
        "| construct | result |",
        "| --------- | ------ |",
        "| ==hi== | %%gone%% |",
        "| ^[note] | plain |",
      ].join("\n"),
    );

    const json = JSON.stringify(tree);

    expect(json).toContain('"value":"hi"');
    expect(json).toContain('"hName":"mark"');
    expect(json).toContain('"value":"note"');
    expect(json).toContain('"hName":"sup"');
    expect(json).not.toContain("%%gone%%");
  });

  it("transforms highlights, comments and footnotes in blockquote bodies", () => {
    const tree = process("> ==hi== %%gone%% ^[note]");

    expect(tree).toMatchObject({
      children: [
        {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", value: "hi", data: { hName: "mark" } },
                { type: "text", value: " " },
                { type: "text", value: " " },
                { type: "text", value: "note", data: { hName: "sup" } },
              ],
            },
          ],
        },
      ],
    });
  });
});
