import type { ContentMetadata } from "./content-map.js";
import { slugify, slugifyUrl, WIKI_LINK_REGEX } from "./utils.js";
import { parseWikiLink } from "./wiki-links.js";

export type FrontmatterLink = {
  url: string;
  label: string;
};

export type GetFrontmatterOptions = {
  contentMap: Map<string, ContentMetadata>;
  slugify?: (text: string) => string;
  urlPrefix?: string;
  ignoredKeys?: string[];
};

/**
 * Resolves the values of a parsed frontmatter object so they can be rendered
 * directly by a consumer (e.g. fumadocs). Wiki links (`[[Note]]`) and URLs
 * inside string values are resolved to `{ url, label }` objects that fumadocs'
 * `createRelativeLink` can route (it expects root-relative URLs starting with
 * `/`). Unresolved wiki links degrade gracefully to their label text.
 *
 * A string value is resolved to a `{ url, label }` link **only when the whole
 * value is a single wiki link or URL** (e.g. `"[[Note]]"`,
 * `"[[Note|Alias]]"`, `"https://example.com"`). Strings that merely *contain*
 * a link alongside other text are returned unchanged, so no surrounding text
 * or extra links are silently dropped. Every other value type (boolean,
 * number, array, plain string) is returned unchanged.
 */
export function getFrontmatter(
  frontmatter: Record<string, unknown>,
  options: GetFrontmatterOptions,
): Record<string, unknown> {
  const ignoredKeys = options.ignoredKeys ?? [];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    if (ignoredKeys.includes(key)) continue;
    result[key] = resolveValue(value, options);
  }

  return result;
}

function resolveValue(value: unknown, options: GetFrontmatterOptions): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, options));
  }

  if (typeof value !== "string") {
    return value;
  }

  const slugifyFn = options.slugify ?? slugify;
  const trimmed = value.trim();

  // Only resolve when the whole value is a single link or URL. Mixed strings
  // (e.g. "See [[Note]] now" or "[[A]] and [[B]]") are returned unchanged so no
  // surrounding text or extra links are silently discarded. The wiki-link
  // branch forbids `]` inside the brackets so a string with several `[[...]]`
  // is not mistaken for one link.
  const isWholeLink = /^(?:!?\[\[[^\]]*\]\]|https?:\/\/\S+)$/.test(trimmed);
  if (!isWholeLink) return value;

  const urlMatch = trimmed.match(/^https?:\/\/\S+$/);
  if (urlMatch) {
    return { url: trimmed, label: trimmed } satisfies FrontmatterLink;
  }

  // `trimmed` is a whole wiki link, so extract the inner content (between the
  // brackets) before parsing — parseWikiLink expects the text without `[[ ]]`.
  const innerMatch = trimmed.match(WIKI_LINK_REGEX);
  const linkText = innerMatch ? (innerMatch[2] ?? trimmed) : trimmed;
  const parsed = parseWikiLink(linkText);
  if (!parsed) return value;

  const { alias, anchor, target } = parsed;
  const label = alias || target;

  const metadata = options.contentMap.get(target.toLowerCase());
  if (!metadata) return label;

  const resolvedUrl = slugifyUrl(metadata.path, {
    slugify: slugifyFn,
    ...(options.urlPrefix ? { urlPrefix: options.urlPrefix } : {}),
    ...(anchor ? { anchor } : {}),
  });

  return { url: resolvedUrl, label } satisfies FrontmatterLink;
}
