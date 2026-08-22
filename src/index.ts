import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";
import type { VFile } from "vfile";

import { type ContentMetadata, getContentMap } from "./content-map.js";
import { processEmbeds } from "./embeds.js";
import {
  type FrontmatterLink,
  type GetFrontmatterOptions,
  getFrontmatter,
} from "./frontmatter.js";
import { processHighlights } from "./highlights.js";
import { DEFAULT_OPTIONS, type Options } from "./types.js";
import { slugify } from "./utils.js";
import { processWikiLinks } from "./wiki-links.js";

function remarkObsidianMd(
  this: Processor,
  options?: Options,
): Transformer<Root> {
  const pluginOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    customProps: options?.customProps || {},
  };

  return async (tree: Root, _file: VFile) => {
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
  };
}

export default remarkObsidianMd;
export {
  getContentMap,
  getFrontmatter,
  slugify,
  type Options,
  type ContentMetadata,
  type FrontmatterLink,
  type GetFrontmatterOptions,
};
