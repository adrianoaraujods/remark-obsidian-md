import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";

import { configureComments } from "./comments.js";
import { configureFootnotes } from "./footnotes.js";
import { configureHighlights } from "./highlights.js";
import type { RemarkObsidianMdOptions } from "./types.js";
import { configureWikiLinks, transformWikiLinks } from "./wiki-link.js";

/**
 * Composed plugin for the common case: resolves Wiki Links and renders
 * Highlights, Comments and inline Footnotes. Per-feature plugins can be
 * composed by hand instead.
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
  const comments = configureComments(this);
  const highlights = configureHighlights(this);
  const footnotes = configureFootnotes(this);

  return (tree, file) => {
    comments(tree, file, () => {});
    highlights(tree, file, () => {});
    footnotes(tree, file, () => {});
    transformWikiLinks(tree, wikiLinks);
  };
}

export default remarkObsidianMd;

export { remarkObsidianComments } from "./comments.js";
export { remarkObsidianFootnotes } from "./footnotes.js";
export type {
  FrontmatterLink,
  GetFrontmatterOptions,
} from "./frontmatter.js";
export { getFrontmatter } from "./frontmatter.js";
export { remarkObsidianHighlights } from "./highlights.js";
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
