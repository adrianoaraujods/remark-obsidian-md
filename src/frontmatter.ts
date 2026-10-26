import type { PropertyTypes } from "./property-types.js";
import type { Resolver, SlugifyPath } from "./types.js";
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
   * A wiki link whose target names no Note in the Vault (missing Note, or an
   * Asset): unresolved like Obsidian, so consumers can style it instead of
   * mistaking it for plain text.
   */
  | { url?: undefined; label: string; unresolved: true };

/**
 * A whole-value ISO date (`2025-02-03`) or datetime (`2026-02-17T11:33`).
 * The ISO string is preserved verbatim — no re-serialisation, no timezone
 * arithmetic — so consumers can format it however they like.
 */
export type FrontmatterDate = {
  date: string;
  kind: "date" | "datetime";
};

export type GetFrontmatterOptions = {
  resolver: Resolver;
  slugify?: (text: string) => string;
  /** Maps a Note path to the URL path it is published under. */
  slugifyPath?: SlugifyPath | undefined;
  urlPrefix?: string;
  ignoredKeys?: string[];
  /**
   * Obsidian's property type map (see {@link filesystemPropertyTypes}).
   * Properties declared as `date`/`datetime` are tagged according to their
   * declared type; properties declared as any other type are never tagged.
   * Untyped properties are tagged by shape when the whole value is a valid
   * ISO date/datetime.
   */
  types?: PropertyTypes | undefined;
};

/**
 * Resolves the values of a parsed frontmatter object so they can be rendered
 * directly by a consumer (e.g. fumadocs). Wiki links (`[[Note]]`), URLs and
 * markdown links (`[label](https://example.com)`) inside string values are
 * resolved to `{ url, label }` objects; wiki links whose target names no Note
 * come back as `{ label, unresolved: true }` so consumers can style them like
 * Obsidian does. Markdown links are treated as external references: the
 * target is emitted verbatim, never resolved against the Vault. Whole-value
 * ISO dates come back as `{ date, kind }` — the ISO string verbatim plus its
 * kind — so consumers can format them; formatting itself is the consumer's
 * job.
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
    const date = dateValueFor(value, options.types?.[key]);
    result[key] = date ?? resolveValue(value, options);
  }

  return result;
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/** Calendar-aware: `2026-02-30` and other impossible dates are not dates. */
function isoDateKind(value: string): "date" | "datetime" | undefined {
  const dateMatch = ISO_DATE_REGEX.exec(value);
  if (dateMatch) {
    return isCalendarDate(dateMatch) ? "date" : undefined;
  }

  const timeMatch = ISO_DATETIME_REGEX.exec(value);
  if (!timeMatch) return undefined;
  const [, , , , hour, minute, second] = timeMatch;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    return undefined;
  }
  return isCalendarDate(timeMatch) ? "datetime" : undefined;
}

function isCalendarDate(match: RegExpExecArray): boolean {
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

/**
 * Tags whole-value dates for **top-level keys only**, like Obsidian: a
 * property declared `date`/`datetime` in `types` is tagged according to its
 * declared type (and left alone when the value does not match); an untyped
 * property is tagged by shape; a property declared as any other type is never
 * tagged. Arrays, nested objects and non-string values are left alone —
 * Obsidian's date properties are single-valued.
 */
function dateValueFor(
  value: unknown,
  declared: string | undefined,
): FrontmatterDate | undefined {
  if (typeof value !== "string") return undefined;
  if (
    declared !== undefined &&
    declared !== "date" &&
    declared !== "datetime"
  ) {
    return undefined;
  }

  const trimmed = value.trim();
  const kind = declared ?? isoDateKind(trimmed);
  if (kind === undefined || isoDateKind(trimmed) !== kind) return undefined;

  return { date: trimmed, kind };
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
    slugifyPath: options.slugifyPath,
    ...(options.urlPrefix ? { urlPrefix: options.urlPrefix } : {}),
    ...(anchor ? { anchor } : {}),
  });

  return { url: resolvedUrl, label } satisfies FrontmatterLink;
}
