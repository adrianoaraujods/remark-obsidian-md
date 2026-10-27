import type { SlugifyPath } from "./types.js";
import { normalizePath, slugify, slugifySegments } from "./utils.js";

/**
 * Assigns every Note path a distinct slug, so two Notes whose names slugify
 * alike (`Sebá.md` and `Sebã.md`) can both be published.
 *
 * The first Note of a colliding group keeps the plain slug, the others get
 * `-2`, `-3`, … on the last segment; a slug another Note already owns is
 * never taken. Paths are sorted, so the assignment does not depend on the
 * order the Vault is scanned in. An `index` Note is published under its
 * folder, and moves to `<folder>/index` when a Note with that name exists.
 */
export function createSlugifyPath(
  paths: Iterable<string>,
  options: { slugify?: (text: string) => string } = {},
): SlugifyPath {
  const slugifySegment = options.slugify ?? slugify;

  const notePaths = [
    ...new Set([...paths].map(normalizePath).filter(Boolean)),
  ].sort();

  // The slug every Note would get on its own. Notes sharing one form a
  // colliding group.
  const groups = new Map<string, string[]>();
  for (const notePath of notePaths) {
    const plainSlug = plainSlugOf(notePath, slugifySegment);
    const group = groups.get(plainSlug);
    if (group) group.push(notePath);
    else groups.set(plainSlug, [notePath]);
  }

  const taken = new Set(groups.keys());
  const assigned = new Map<string, string>();

  for (const [plainSlug, group] of groups) {
    // A Note called `Notes.md` owns the slug; the `Notes/index.md` of that
    // folder moves to `notes/index`.
    const ordered = [
      ...group.filter((notePath) => !isIndexPath(notePath)),
      ...group.filter(isIndexPath),
    ];
    const owner = ordered.shift();
    if (!owner) continue;

    assigned.set(owner, plainSlug);

    for (const notePath of ordered) {
      const slug = nextSlug(plainSlug, {
        isIndex: isIndexPath(notePath),
        ownerIsIndex: isIndexPath(owner),
        taken,
      });
      assigned.set(notePath, slug);
      taken.add(slug);
    }
  }

  return (path) =>
    assigned.get(normalizePath(path)) ?? fallbackSlug(path, slugifySegment);
}

/** The slug a Note gets on its own; an `index` Note lives under its folder. */
function plainSlugOf(
  notePath: string,
  slugifySegment: (text: string) => string,
): string {
  const segments = notePath.split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  return slugifySegments(segments, slugifySegment);
}

function nextSlug(
  plainSlug: string,
  options: { isIndex: boolean; ownerIsIndex: boolean; taken: Set<string> },
): string {
  if (options.isIndex && !options.ownerIsIndex) {
    let counter = 2;
    let slug = `${plainSlug}/index`;
    while (options.taken.has(slug)) {
      slug = `${plainSlug}/index-${counter}`;
      counter += 1;
    }
    return slug;
  }

  let counter = 2;
  let slug = `${plainSlug}-${counter}`;
  while (options.taken.has(slug)) {
    counter += 1;
    slug = `${plainSlug}-${counter}`;
  }
  return slug;
}

function isIndexPath(notePath: string): boolean {
  return notePath.split("/").at(-1) === "index";
}

/** A path the map does not know keeps the plain per-segment slug. */
function fallbackSlug(
  path: string,
  slugifySegment: (text: string) => string,
): string {
  return slugifySegments(
    normalizePath(path).split("/").filter(Boolean),
    slugifySegment,
  );
}
