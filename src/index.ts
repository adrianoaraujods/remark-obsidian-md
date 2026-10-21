import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";

import { processHighlights } from "./highlights.js";
import type { RemarkObsidianMdOptions } from "./types.js";
import { configureWikiLinks, transformWikiLinks } from "./wiki-link.js";

/**
 * Composed plugin for the common case: resolves Wiki Links and renders
 * Highlights. Per-feature plugins can be composed by hand instead.
 */
export function remarkObsidianMd(
  this: Processor,
  options: RemarkObsidianMdOptions = {},
): Transformer<Root> {
  const wikiLinks = configureWikiLinks(this, {
    resolver: options.resolver,
    slugify: options.slugify,
    urlPrefix: options.urlPrefix,
    unresolvedStrategy: options.wikiLinks?.unresolvedStrategy,
  });

  return (tree) => {
    transformWikiLinks(tree, wikiLinks);
    processHighlights(tree);
  };
}

export default remarkObsidianMd;

export type {
  FrontmatterLink,
  GetFrontmatterOptions,
} from "./frontmatter.js";
export { getFrontmatter } from "./frontmatter.js";
export { type MapResolverEntry, mapResolver } from "./resolver.js";
export type {
  NoteMetadata,
  RemarkObsidianMdOptions,
  ResolvedTarget,
  Resolver,
  UnresolvedStrategy,
  WikiLinksOptions,
  WikiLinksPluginOptions,
} from "./types.js";
export { slugify } from "./utils.js";
export { remarkObsidianWikiLinks } from "./wiki-link.js";
