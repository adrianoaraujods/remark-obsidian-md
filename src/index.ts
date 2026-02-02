import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";

import { type ContentMetadata, getContentMap } from "./content-map";
import { slugify } from "./util";
import { processWikiLinks } from "./wiki-links";

export type PluginOptions = {
  /**
   * A function that returns the Content Map or a Promise resolving to it.
   * This keys should be lowercase filenames (e.g., "my file").
   */
  getContentMap: () =>
    | Promise<Map<string, ContentMetadata>>
    | Map<string, ContentMetadata>;
  /**
   * The directory where your vault with the static assets (images) and markdown files are located.
   * @default "./public"
   */
  root?: string;
  /**
   * A function that converts a string into a URL-friendly slug.
   */
  slugify?: (text: string) => string;
  /**
   * If you want to support the [[Wiki Link]] syntax.
   * @default true
   */
  wikiLinks?: boolean;
  notFoundLinkProps?: Record<string, string>;
  urlPrefix?: string;
};

export default function plugin(options?: PluginOptions): Transformer<Root> {
  return async function transformer(this: Processor, tree: Root) {
    const rootDir = options?.root || "./public";

    const useWikiLinks = options?.wikiLinks || true;
    if (useWikiLinks) {
      const contentMap =
        (await options?.getContentMap()) || (await getContentMap(rootDir));
      const slugifyFunction = options?.slugify || slugify;
      const notFoundLinkProps = options?.notFoundLinkProps || {};

      processWikiLinks(
        tree,
        rootDir,
        contentMap,
        this,
        slugifyFunction,
        notFoundLinkProps,
        options?.urlPrefix,
      );
    }
  };
}
