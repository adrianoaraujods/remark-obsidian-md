/** biome-ignore-all lint/suspicious/noExplicitAny: HTML element properties could be of any type */

import { type ContentMetadata, getContentMap } from "./content-map.js";
import { slugify } from "./utils.js";

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
   * @default Result of {@link getContentMap}
   */
  contentMap?: Map<string, ContentMetadata>;

  /**
   * If you want to support links with (e.g., `[[Wiki Link]]`).
   * @default true
   */
  enableWikiLinks?: boolean;

  /**
   * If you want to support text embeds (e.g., `![[Wiki Link]]`).
   * @default true
   */
  enableEmbeds?: boolean;

  /**
   * A prefix that will be prepended in the slugified URLs.
   */
  urlPrefix?: string;

  /**
   * Custom HTML properties for each type of node.
   */
  customProps?: {
    wikiLinks?: Record<string, any>;
    notFoundWikiLinks?: Record<string, any>;
    imageLinks?: Record<string, any>;
    imageEmbeds?: Record<string, any>;
  };
};

export const DEFAULT_OPTIONS = {
  enableWikiLinks: true,
  enableEmbeds: true,
  root: "./public",
  slugify,
  customProps: {},
  urlPrefix: "",
} satisfies Options;
