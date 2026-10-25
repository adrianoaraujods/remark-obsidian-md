import type { Resolver } from "./types.js";
import {
  anchorFor,
  githubSlugger,
  isPlainObject,
  parseWikiLink,
  slugify,
  slugifyUrl,
  WIKI_LINK_REGEX,
} from "./utils.js";
import { aliasOrTarget } from "./wiki-link.js";

export type FrontmatterLink =
  | { url: string; label: string }
  /**
   * A wiki link whose target has no page in the vault (missing note, or an
   * asset): unresolved like Obsidian, so consumers can style it instead of
   * mistaking it for plain text.
   */
  | { url?: undefined; label: string; unresolved: true };

export type GetFrontmatterOptions = {
  resolver: Resolver;
  slugify?: (text: string) => string;
  urlPrefix?: string;
  ignoredKeys?: string[];
};

/**
 * Resolves the values of a parsed frontmatter object so they can be rendered
 * directly by a consumer (e.g. fumadocs). Wiki links (`[[Note]]`), URLs and
 * markdown links (`[label](https://example.com)`) inside string values are
 * resolved to `{ url, label }` objects; wiki links whose target has no page
 * come back as `{ label, unresolved: true }` so consumers can style them like
 * Obsidian does. Markdown links are treated as external references: the
 * target is emitted verbatim, never resolved against the vault.
 *
 * A string value is resolved to a `{ url, label }` link **only when the whole
 * value is a single link** (e.g. `"[[Note]]"`, `"[[Note|Alias]]"`,
 * `"[Source](https://example.com)"`, `"https://example.com"`). Strings that
 * merely *contain* a link alongside other text are returned unchanged, so no
 * surrounding text or extra links is silently dropped. Arrays and nested
 * objects are resolved recursively; every other value type (boolean, number,
 * Date) is returned unchanged.
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

const MARKDOWN_LINK_REGEX = /^\[([^\]]+)\]\((.*)\)$/;

function resolveValue(value: unknown, options: GetFrontmatterOptions): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, options));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveValue(item, options),
      ]),
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  const slugifyFn = options.slugify ?? slugify;
  const trimmed = value.trim();

  // Only resolve when the whole value is a single link or URL. Mixed strings
  // (e.g. "See [[Note]] now" or "[[A]] and [[B]]") are returned unchanged so no
  // surrounding text or extra links is silently discarded. The wiki-link
  // branch forbids `]` inside the brackets so a string with several `[[...]]`
  // is not mistaken for one link; the markdown-link branch rejects targets
  // with whitespace or `](` so glued/multi-link strings stay unchanged too.
  const markdownLink = MARKDOWN_LINK_REGEX.exec(trimmed);
  if (markdownLink) {
    const label = markdownLink[1];
    const target = markdownLink[2];
    // Reject targets with whitespace (invalid markdown unless `<>`-wrapped)
    // or `](` (several links glued into one string) so mixed strings stay
    // unchanged instead of being mistaken for a single external reference.
    if (label !== undefined && target && !/\s|\]\(/.test(target)) {
      // Markdown links are external references: emit the target verbatim
      // instead of resolving it against the vault.
      return { url: target, label } satisfies FrontmatterLink;
    }
    return value;
  }

  const isWholeLink = /^(?:\[\[[^\]]*\]\]|https?:\/\/\S+)$/.test(trimmed);
  if (!isWholeLink) return value;

  const urlMatch = trimmed.match(/^https?:\/\/\S+$/);
  if (urlMatch) {
    return { url: trimmed, label: trimmed } satisfies FrontmatterLink;
  }

  // `trimmed` is a whole wiki link, so extract the inner content before
  // parsing — parseWikiLink expects the text without `[[ ]]`.
  const innerMatch = trimmed.match(WIKI_LINK_REGEX);
  const linkText = innerMatch ? (innerMatch[2] ?? trimmed) : trimmed;
  const parsed = parseWikiLink(linkText);
  if (!parsed) return value;

  const { target } = parsed;
  const label = aliasOrTarget(parsed);
  const anchor = anchorFor(parsed.subpath, githubSlugger);

  const resolved = options.resolver.resolve(target);
  if (!resolved.exists || resolved.kind !== "note") {
    return { label, unresolved: true } satisfies FrontmatterLink;
  }

  const resolvedUrl = slugifyUrl(resolved.path, {
    slugify: slugifyFn,
    ...(options.urlPrefix ? { urlPrefix: options.urlPrefix } : {}),
    ...(anchor ? { anchor } : {}),
  });

  return { url: resolvedUrl, label } satisfies FrontmatterLink;
}
