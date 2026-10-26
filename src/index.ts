import type { Root } from "mdast";
import type { Processor, Transformer } from "unified";

import { processBlockIds } from "./block-id.js";
import { transformCallouts } from "./callouts.js";
import { configureComments } from "./comments.js";
import { configureEmbeds, finalizeEmbeds, transformEmbeds } from "./embed.js";
import { configureFootnotes } from "./footnotes.js";
import { configureHighlights } from "./highlights.js";
import type { RemarkObsidianMdOptions } from "./types.js";
import { configureWikiLinks, transformWikiLinks } from "./wiki-link.js";

/**
 * Composed plugin for the common case: renders Callouts, resolves Wiki Links,
 * expands Embeds and renders Highlights, Comments and inline Footnotes.
 * Per-feature plugins can be composed by hand instead.
 */
export function remarkObsidianMd(
  this: Processor,
  options: RemarkObsidianMdOptions = {},
): Transformer<Root> {
  const wikiLinks = configureWikiLinks(this, {
    resolver: options.resolver,
    slugger: options.wikiLinks?.slugger,
    slugify: options.slugify,
    slugifyPath: options.slugifyPath,
    urlPrefix: options.urlPrefix,
    unresolvedStrategy: options.wikiLinks?.unresolvedStrategy,
  });
  const comments = configureComments(this);
  const highlights = configureHighlights(this);
  const footnotes = configureFootnotes(this);

  const embeds = configureEmbeds(this, {
    readNote: options.embeds?.readNote,
    maxDepth: options.embeds?.maxDepth,
    wikiLinks,
  });

  return (tree) => {
    // Embeds expand first so the later transforms also reach their children.
    transformEmbeds(tree, embeds);
    transformCallouts(tree, options.callouts);

    // Embed containers are finalized after Callouts, which rewraps callout
    // body lines into new paragraphs the Embed expansion never saw.
    finalizeEmbeds(tree);

    // Comments run before the remaining transforms so an unclosed `%%` hides
    // the rest of the Note, including anything that follows it.
    comments(tree);

    const blockIds = processBlockIds(tree);

    transformWikiLinks(tree, {
      ...wikiLinks,
      blockIds: {
        current: blockIds,
        readNote: options.blockIds?.readNote ?? options.embeds?.readNote,
      },
    });

    highlights(tree);
    footnotes(tree);
  };
}

export default remarkObsidianMd;

export { remarkObsidianBlockIds } from "./block-id.js";
export { remarkObsidianCallouts } from "./callouts.js";
export { remarkObsidianComments } from "./comments.js";
export { remarkObsidianEmbeds } from "./embed.js";
export { remarkObsidianFootnotes } from "./footnotes.js";
export type {
  FrontmatterDate,
  FrontmatterLink,
  GetFrontmatterOptions,
} from "./frontmatter.js";
export { getFrontmatter } from "./frontmatter.js";
export { remarkObsidianHighlights } from "./highlights.js";
export {
  filesystemPropertyTypes,
  type PropertyTypes,
} from "./property-types.js";
export {
  type DuplicatePolicy,
  type FilesystemResolverOptions,
  filesystemResolver,
  type MapResolverEntry,
  mapResolver,
} from "./resolver.js";
export { createSlugifyPath } from "./slugs.js";
export type {
  BlockIdsOptions,
  CalloutsPluginOptions,
  CalloutTypeDefinition,
  EmbedsOptions,
  EmbedsPluginOptions,
  NoteMetadata,
  RemarkObsidianMdOptions,
  ResolvedTarget,
  Resolver,
  SlugifyPath,
  UnresolvedStrategy,
  WikiLinksOptions,
  WikiLinksPluginOptions,
} from "./types.js";
export { slugify } from "./utils.js";
export { remarkObsidianWikiLinks } from "./wiki-link.js";
