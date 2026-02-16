import fs from "node:fs";
import { fromHtml } from "hast-util-from-html";
import yaml from "js-yaml";
import type { Root, RootContent } from "mdast";

import {
  SVG_ARROW_RIGHT,
  SVG_BINARY,
  SVG_CALENDAR,
  SVG_CLOCK,
  SVG_LIST,
  SVG_SQUARE_CHECK_BIG,
  SVG_TEXT,
} from "./icons.js";
import type { Options } from "./types.js";
import { FRONTMATTER_REGEX, h, slugify, WIKI_LINK_REGEX } from "./utils.js";
import { parseWikiLink } from "./wiki-links.js";

export function processFrontmatter(
  tree: Root,
  path: string,
  options: Required<Options>,
) {
  const rawContent = fs.readFileSync(path, "utf-8");
  const match = rawContent.match(FRONTMATTER_REGEX);
  if (!match || !match[1]) return;

  let properties: Record<string, unknown> = {};
  try {
    const frontmatter = yaml.load(match[1]);

    if (typeof frontmatter === "object" && frontmatter !== null) {
      properties = frontmatter as Record<string, unknown>;
    }
  } catch (error) {
    console.warn(`Failed to parse frontmatter for ${path}`, error);
    return;
  }

  const entries = Object.entries(properties).filter(
    ([key]) => !options.ignoredFrontmatterKeys.includes(key),
  );
  if (entries.length === 0) return;

  const props: Required<NonNullable<Options["customProps"]>["frontmatter"]> = {
    container: {
      className: "frontmatter",
      open: true,
      ...options.customProps.frontmatter?.container,
    },
    collapse: {
      className: "frontmatter-collapse-icon",
      ...options.customProps.frontmatter?.collapse,
    },
    title: {
      className: "frontmatter-title",
      ...options.customProps.frontmatter?.title,
    },
    properties: {
      className: "frontmatter-properties",
      ...options.customProps.frontmatter?.properties,
    },
    property: {
      className: "frontmatter-property",
      ...options.customProps.frontmatter?.property,
    },
    icon: {
      className: "frontmatter-icon",
      ...options.customProps.frontmatter?.icon,
    },
    key: {
      className: "frontmatter-property-key",
      ...options.customProps.frontmatter?.key,
    },
    value: {
      className: "frontmatter-property-value",
      ...options.customProps.frontmatter?.value,
    },
  };

  const element = h("details", props.container, [
    h("summary", props.title, [
      h("div", {
        ...props.collapse,
        hChildren: [
          fromHtml(props.collapse.children || SVG_ARROW_RIGHT, {
            fragment: true,
          }).children[0],
        ],
      }),
      { type: "text", value: props.title?.children || "Properties" },
    ]),

    h(
      "ul",
      props.properties,
      entries.map(([key, value]) => {
        const { icon, nodes, type } = formatValue(value, options);

        return h("li", props.property, [
          h("div", {
            ...props.icon,
            hChildren: [fromHtml(icon, { fragment: true }).children[0]],
          }),
          h("div", { ...props.key }, [{ type: "text", value: String(key) }]),
          h("div", { ...props.value, "data-type": type }, nodes),
        ]);
      }),
    ),
  ]);

  tree.children.unshift(element);
}

type ValueNode = {
  type: "string" | "list" | "boolean" | "date" | "time" | "number";
  icon: string;
  nodes: RootContent[];
};

function formatValue(value: unknown, options: Required<Options>): ValueNode {
  if (Array.isArray(value)) {
    return {
      type: "list",
      icon: SVG_LIST,
      nodes: [
        h(
          "ul",
          {},
          value.map((value) => {
            const { nodes } = formatValue(value, options);
            return h("li", {}, nodes);
          }),
        ),
      ],
    };
  }

  if (typeof value === "boolean") {
    return {
      type: "boolean",
      icon: SVG_SQUARE_CHECK_BIG,
      nodes: [
        h("input", {
          type: "checkbox",
          disabled: true,
          checked: value,
        }),
      ],
    };
  }

  if (typeof value === "number") {
    return {
      type: "number",
      icon: SVG_BINARY,
      nodes: [{ type: "text", value: String(value) }],
    };
  }

  let dateValue = value;
  if (typeof value === "string") {
    const ISO_LIKE_REGEX =
      /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
    if (ISO_LIKE_REGEX.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        dateValue = parsed;
      }
    }
  }

  if (dateValue instanceof Date) {
    const isMidnight =
      dateValue.getUTCHours() === 0 &&
      dateValue.getUTCMinutes() === 0 &&
      dateValue.getUTCSeconds() === 0;

    const showTime = !isMidnight;

    if (!showTime) {
      return {
        type: "date",
        icon: SVG_CALENDAR,
        nodes: [
          {
            type: "text",
            value: dateValue.toLocaleDateString([], {
              timeZone: "UTC",
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            }),
          },
        ],
      };
    }

    return {
      type: "time",
      icon: SVG_CLOCK,
      nodes: [
        {
          type: "text",
          value: `${dateValue.toLocaleDateString([], {
            timeZone: "UTC",
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })}, ${dateValue.toLocaleTimeString([], {
            minute: "2-digit",
            hour: "2-digit",
            timeZone: "UTC",
          })}`,
        },
      ],
    };
  }

  const string = String(value);
  const fallback: ValueNode = {
    type: "string",
    icon: SVG_TEXT,
    nodes: [{ type: "text", value: string }],
  };

  const LINK_REGEX = new RegExp(
    `(?:${WIKI_LINK_REGEX.source})|(https?:\\/\\/[^\\s]+)`,
  );

  const match = LINK_REGEX.exec(string);
  if (!match) return fallback;

  const [_, __, wikilink, url] = match;
  if (url) {
    return {
      type: "string",
      icon: SVG_TEXT,
      nodes: [{ type: "link", url, children: [{ type: "text", value: url }] }],
    };
  }

  const parse = parseWikiLink(String(wikilink));
  if (!parse) return fallback;

  const { alias, anchor, target } = parse;
  const label = alias || target;

  const metadata = options.contentMap.get(target.toLocaleLowerCase());
  if (!metadata) {
    return {
      type: "string",
      icon: SVG_TEXT,
      nodes: [
        {
          type: "link",
          url: "#",
          children: [{ type: "text", value: label }],
          data: { hProperties: options.customProps.notFoundWikiLinks },
        },
      ],
    };
  }

  const isImage = metadata.type === "img";
  if (isImage) {
    return {
      type: "string",
      icon: SVG_TEXT,
      nodes: [
        {
          type: "link",
          url: metadata.path,
          children: [{ type: "text", value: label }],
          data: { hProperties: options.customProps.imageLinks },
        },
      ],
    };
  }

  const slugifiedUrl = `${options.urlPrefix ? `${options.urlPrefix}/` : ""}${metadata.path
    .replace(/\.mdx?$/, "")
    .split("/")
    .map((part) => slugify(part))
    .join("/")}${anchor ? `#${slugify(anchor)}` : ""}`;

  return {
    type: "string",
    icon: SVG_TEXT,
    nodes: [
      {
        type: "link",
        url: slugifiedUrl,
        children: [{ type: "text", value: label }],
        data: { hProperties: options.customProps.wikiLinks },
      },
    ],
  };
}
