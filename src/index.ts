import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";
import { DEFAULT_CALLOUTS, processCallouts } from "./callouts.js";
import { type ContentMetadata, getContentMap } from "./content-map.js";
import { processEmbeds } from "./embeds.js";
import { processHighlights } from "./highlights.js";
import { DEFAULT_OPTIONS, type Options } from "./types.js";
import type { slugify } from "./utils.js";
import { processWikiLinks } from "./wiki-links.js";

function remarkObsidianMd(
  this: Processor,
  options?: Options,
): Transformer<Root> {
  const pluginOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    callouts: { ...DEFAULT_CALLOUTS, ...options?.callouts },
    customProps: options?.customProps || {},
  };

  return async (tree: Root) => {
    if (!pluginOptions.contentMap) {
      pluginOptions.contentMap = await getContentMap(pluginOptions.root);
    }

    if (pluginOptions.enableWikiLinks) {
      processWikiLinks(this, tree, pluginOptions as Required<Options>);

      if (pluginOptions.enableEmbeds) {
        processEmbeds(tree);
      }
    }

    if (pluginOptions.enableHighlights) {
      processHighlights(tree, pluginOptions.customProps.highlights);
    }

    if (pluginOptions.enableCallouts) {
      processCallouts(tree, pluginOptions);
    }
  };
}

export default remarkObsidianMd;
export { getContentMap, type slugify, type Options, type ContentMetadata };
