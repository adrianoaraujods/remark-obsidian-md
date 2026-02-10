import type { PhrasingContent, Root } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";
import type { Options } from "./types.js";
import { HIGHLIGHT_REGEX } from "./utils.js";

export function processHighlights(
  tree: Root,
  props: Required<Options>["customProps"]["highlights"],
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
