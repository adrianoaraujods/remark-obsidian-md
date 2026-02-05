import type { ContentMetadata } from "./content-map.js";

export type Options = {
  /**
   * The directory path where the obsidian vault is located.
   * @default "./public"
   */
  root?: string;

  /**
   * A function that converts a string into a URL-friendly slug.
   * @param text
   * @returns
   */
  slugify?: (text: string) => string;

  /**
   * A Map that contains all the valid markdown and image files inside the vault folder.
   *
   * The keys should be the file name without the extension (except if is a image) in
   * lowercase (e.g., "my file" or "image.png").
   *
   * @default return of {@link {import("./content-map").getContentMap}}
   */
  contentMap?: Map<string, ContentMetadata>;

  /**
   * If you want to support links with `[[Wiki Link]]` syntax.
   * @default true
   */
  enableWikiLinks?: boolean;

  /**
   * A prefix that will be prepended in the slugified URLs.
   */
  urlPrefix?: string;

  notFoundLinkProps?: Record<string, string>;
};
