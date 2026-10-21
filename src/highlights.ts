import type { PhrasingContent, Root } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";

import { HIGHLIGHT_REGEX } from "./utils.js";

export function processHighlights(
  tree: Root,
  props: Record<string, unknown> = {},
) {
  findAndReplace(tree, [
    [
      HIGHLIGHT_REGEX,
      (_: string, text: string): PhrasingContent => {
        return {
          type: "text",
          value: text,
          data: { hName: "mark", hProperties: props },
        };
      },
    ],
  ]);
}
