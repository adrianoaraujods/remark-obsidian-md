import type { Root } from "mdast";
import type { Processor } from "unified";
import { processCallouts } from "./callouts.js";
import { processEmbeds } from "./embeds.js";
import type { Options } from "./types.js";
import { processWikiLinks } from "./wiki-links.js";

export function transformTree(
  processor: Processor,
  tree: Root,
  options: Required<Options>,
) {
  if (options.enableWikiLinks) {
    processWikiLinks(processor, tree, options);

    if (options.enableEmbeds) {
      processEmbeds(tree);
    }
  }

  if (options.enableCallouts) {
    processCallouts(tree, options);
  }
}
