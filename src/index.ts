import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";

import { type ContentMetadata, getContentMap } from "./content-map.js";
import type { Options } from "./types.js";
import { slugify } from "./util.js";
import { processWikiLinks } from "./wiki-links.js";

const DEFAULT_OPTIONS = {
  enableWikiLinks: true,
  root: "./public",
  slugify,
} satisfies Options;

function remarkObsidianMd(
  this: Processor,
  options?: Options,
): Transformer<Root> {
  const {
    enableWikiLinks,
    root,
    slugify,
    contentMap,
    urlPrefix,
    notFoundLinkProps,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return async (tree: Root) => {
    if (enableWikiLinks) {
      processWikiLinks(
        tree,
        root,
        contentMap || (await getContentMap(root)),
        this,
        slugify,
        notFoundLinkProps || {},
        urlPrefix,
      );
    }
  };
}

export default remarkObsidianMd;
export { getContentMap, slugify, type Options, type ContentMetadata };
