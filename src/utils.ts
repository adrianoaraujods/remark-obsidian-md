export const WIKI_LINK_REGEX = /(!)?\[\[(.*?)\]\]/;

/**
 * Splits the inner text of a Wiki Link into its Link Target, Alias and
 * Subpath.
 */
export function parseWikiLink(content: string) {
  const pipeIndex = content.indexOf("|");

  let rawTarget: string;
  let alias: string | undefined;

  if (pipeIndex === -1) {
    rawTarget = content;
  } else {
    rawTarget = content.slice(0, pipeIndex);
    alias = content.slice(pipeIndex + 1).trim();
  }

  // Clean up whitespace and normalize slashes
  rawTarget = rawTarget.replace(/\\/g, "/").trim();
  if (!rawTarget) return null;

  let [target, anchor] = rawTarget.split("#");
  target = target ? target.trim() : "";
  anchor = anchor ? anchor.trim().toLowerCase() : undefined;

  return { target, alias, anchor, rawTarget };
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * @param {string} text - The string to be slugified.
 * @returns {string} A lowercase, hyphenated, URL-safe string.
 * @example
 * slugify("Hello World!");        // "hello-world"
 * slugify("crème brûlée");       // "creme-brulee"
 * slugify("myCamelCaseString");  // "my-camel-case-string"
 */
export function slugify(text: string): string {
  if (!text) return "";

  return (
    text
      .toString()
      .trim()
      // 1. Handle camelCase (e.g., "myPostTitle" -> "my Post Title")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // 2. Normalize accents (e.g., "é" -> "e")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // 3. Lowercase everything
      .toLowerCase()
      // 4. Replace all non-alphanumeric chars with a hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // 5. Remove leading/trailing hyphens and prevent double hyphens
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  );
}

/**
 * Builds a root-relative, slugified URL from a vault-relative file path.
 *
 * @param path - The file path as stored in the content map (with or without a
 *   leading slash).
 * @param options.slugify - Slugify function used per path segment.
 * @param options.urlPrefix - Optional prefix prepended to the URL (e.g. "/docs").
 * @param options.anchor - Optional heading anchor (already lowercased).
 * @returns A URL starting with `/`, e.g. `/docs/folder/note#some-heading`.
 */
export function slugifyUrl(
  path: string,
  options: {
    slugify: (text: string) => string;
    urlPrefix?: string;
    anchor?: string;
  },
): string {
  const base = path.replace(/\.mdx?$/, "");
  const slug = base
    .split("/")
    .filter(Boolean)
    .map((part) => options.slugify(part))
    .join("/");

  const trimmedPrefix = options.urlPrefix?.replace(/^\/+|\/+$/g, "");
  const prefixPart = trimmedPrefix ? `${trimmedPrefix}/` : "";

  const anchorPart = options.anchor
    ? `#${options.slugify(options.anchor)}`
    : "";

  return `/${prefixPart}${slug}${anchorPart}`;
}
