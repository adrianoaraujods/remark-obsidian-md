import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";
import type { VFile } from "vfile";

import { DEFAULT_CALLOUTS, processCallouts } from "./callouts.js";
import { type ContentMetadata, getContentMap } from "./content-map.js";
import { processEmbeds } from "./embeds.js";
import { processFrontmatter } from "./frontmatter.js";
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
    callouts: { ...DEFAULT_CALLOUTS, ...options?.callouts },
    customProps: options?.customProps || {},
  };

  return async (tree: Root, file: VFile) => {
    if (!pluginOptions.contentMap) {
      pluginOptions.contentMap = await getContentMap(
        pluginOptions.root,
        pluginOptions.publicFolder,
      );
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

    if (pluginOptions.enableFrontmatter) {
      processFrontmatter(tree, file.path, pluginOptions as Required<Options>);
    }
  };
}

export default remarkObsidianMd;
export { getContentMap, slugify, type Options, type ContentMetadata };
