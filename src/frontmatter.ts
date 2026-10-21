import type { Resolver } from "./types.js";
import {
  anchorFor,
  githubSlugger,
  parseWikiLink,
  slugify,
  slugifyUrl,
  WIKI_LINK_REGEX,
} from "./utils.js";

export type FrontmatterLink = {
  url: string;
  label: string;
};

export type GetFrontmatterOptions = {
  resolver: Resolver;
  slugify?: (text: string) => string;
  urlPrefix?: string;
  ignoredKeys?: string[];
};

/**
 * Resolves the values of a parsed frontmatter object so they can be rendered
 * directly by a consumer (e.g. fumadocs). Wiki links (`[[Note]]`) and URLs
 * inside string values are resolved to `{ url, label }` objects. Unresolved
 * wiki links degrade gracefully to their label text.
 *
 * A string value is resolved to a `{ url, label }` link **only when the whole
 * value is a single wiki link or URL** (e.g. `"[[Note]]"`,
 * `"[[Note|Alias]]"`, `"https://example.com"`). Strings that merely *contain*
 * a link alongside other text are returned unchanged, so no surrounding text
 * or extra links is silently dropped. Arrays and nested objects are resolved
 * recursively; every other value type (boolean, number, Date) is returned
 * unchanged.
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
  // is not mistaken for one link.
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

  const { alias, target } = parsed;
  const label = alias || target || parsed.subpaths.at(-1) || "";
  const anchor = anchorFor(parsed.subpath, githubSlugger);

  const resolved = options.resolver.resolve(target);
  if (!resolved.exists || resolved.kind !== "note") return label;

  const resolvedUrl = slugifyUrl(resolved.path, {
    slugify: slugifyFn,
    ...(options.urlPrefix ? { urlPrefix: options.urlPrefix } : {}),
    ...(anchor ? { anchor } : {}),
  });

  return { url: resolvedUrl, label } satisfies FrontmatterLink;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
