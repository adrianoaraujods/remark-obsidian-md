/** biome-ignore-all lint/suspicious/noExplicitAny: HTML element properties could be of any type */

import type { DefaultCallout } from "./callouts.js";
import { type ContentMetadata, getContentMap } from "./content-map.js";
import { SVG_ARROW_RIGHT } from "./icons.js";
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
   * If you want to support callouts (e.g., `> [!info] title`).
   * @default true
   */
  enableCallouts?: boolean;

  /**
   * If you want to support highlights (e.g., `==text==`).
   * @default true
   */
  enableHighlights?: boolean;

  /**
   * Custom SVG to replace the callout collapse icon
   */
  calloutCollapseIcon?: string;

  /**
   * If you want to render callouts using MDX component `<Callout>` instead of HTML elements.
   * @default false
   */
  useMdxCallout?: boolean;

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
    highlights?: Record<string, any>;
    callouts?: {
      container?: Record<string, any>;
      icon?: Record<string, any>;
      title?: Record<string, any>;
      collapse?: Record<string, any>;
    };
  };

  /**
   * Declare custom Callout icons or overwrite the defaults.
   */
  callouts?: {
    [K in DefaultCallout]?: string;
  } & { [key: string]: string };
};

export const DEFAULT_OPTIONS = {
  enableWikiLinks: true,
  enableEmbeds: true,
  enableCallouts: true,
  enableHighlights: true,
  useMdxCallout: false,
  calloutCollapseIcon: SVG_ARROW_RIGHT,
  root: "./public",
  slugify,
  customProps: {},
  urlPrefix: "",
} satisfies Options;
