import type { SlugifyPath } from "./types.js";
import { slugify } from "./utils.js";

/**
 * Assigns every Note path a distinct slug path, so two Notes whose names
 * slugify to the same URL (`Sebá.md` and `Sebã.md`) can both be published.
 *
 * The first Note of a colliding group keeps the plain slug, the others get
 * `-2`, `-3`, … appended. Paths are sorted, so the assignment does not depend
 * on the order the Vault is scanned in. An `index` Note is published under its
 * folder, and moves to `<folder>/index` when a Note with that name exists.
 */
export function createSlugifyPath(
  paths: Iterable<string>,
  options: { slugify?: (text: string) => string } = {},
): SlugifyPath {
  const slugifySegment = options.slugify ?? slugify;
  const notes = [
    ...new Set([...paths].map(normalizePath).filter(Boolean)),
  ].sort();

  const assigned = new Map<string, string>();
  const taken = new Set<string>();

  const assign = (path: string, isIndex: boolean) => {
    const segments = path.split("/");
    const base = (isIndex ? segments.slice(0, -1) : segments)
      .map(slugifySegment)
      .join("/");

    let slug = base;
    if (taken.has(base)) {
      if (isIndex) {
        let counter = 2;
        slug = `${base}/index`;
        while (taken.has(slug)) slug = `${base}/index-${counter++}`;
      } else {
        let counter = 2;
        slug = `${base}-${counter}`;
        while (taken.has(slug)) slug = `${base}-${counter++}`;
      }
    }

    taken.add(slug);
    assigned.set(path, slug);
  };

  // Notes first, index Notes last: a Note called `Notes.md` keeps the plain
  // slug, the `Notes/index.md` of that folder moves aside.
  for (const path of notes) if (!isIndexPath(path)) assign(path, false);
  for (const path of notes) if (isIndexPath(path)) assign(path, true);

  return (path) =>
    assigned.get(normalizePath(path)) ?? fallbackSlug(path, slugifySegment);
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.mdx?$/i, "");
}

function isIndexPath(path: string): boolean {
  return path.split("/").at(-1) === "index";
}

function fallbackSlug(
  path: string,
  slugifySegment: (text: string) => string,
): string {
  const segments = normalizePath(path).split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  return segments.map(slugifySegment).join("/");
}
