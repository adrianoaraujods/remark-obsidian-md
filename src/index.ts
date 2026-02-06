import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";
import { DEFAULT_CALLOUTS } from "./callouts.js";
import { type ContentMetadata, getContentMap } from "./content-map.js";
import { transformTree } from "./transform-tree.js";
import { DEFAULT_OPTIONS, type Options } from "./types.js";
import type { slugify } from "./utils.js";

function remarkObsidianMd(
  this: Processor,
  options?: Options,
): Transformer<Root> {
  const pluginOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    callouts: { ...DEFAULT_CALLOUTS, ...options?.callouts },
  };

  return async (tree: Root) => {
    if (!pluginOptions.contentMap) {
      pluginOptions.contentMap = await getContentMap(pluginOptions.root);
    }

    transformTree(this, tree, pluginOptions as Required<Options>);
  };
}

export default remarkObsidianMd;
export { getContentMap, type slugify, type Options, type ContentMetadata };
