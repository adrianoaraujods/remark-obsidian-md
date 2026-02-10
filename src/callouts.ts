import { fromHtml } from "hast-util-from-html";
import type {
  Blockquote,
  Emphasis,
  Paragraph,
  PhrasingContent,
  Root,
} from "mdast";
import { visit } from "unist-util-visit";

import {
  SVG_BUG,
  SVG_CHECK,
  SVG_CITE,
  SVG_CROSS,
  SVG_ERROR,
  SVG_EXAMPLE,
  SVG_HELP,
  SVG_INFO,
  SVG_NOTE,
  SVG_TIP,
  SVG_TLDR,
  SVG_TODO,
  SVG_WARNING,
} from "./icons.js";
import type { Options } from "./types.js";
import { CALLOUT_REGEX } from "./utils.js";

export function processCallouts(
  tree: Root,
  options: Required<
    Pick<
      Options,
      "useMdxCallout" | "customProps" | "callouts" | "calloutCollapseIcon"
    >
  >,
) {
  visit(tree, "blockquote", (node: Blockquote) => {
    // Look for blockquotes that start with a paragraph
    const firstParagraph = node.children[0];
    if (!firstParagraph || firstParagraph.type !== "paragraph") return;

    // We only care if that paragraph starts with a text node
    const firstTextNode = firstParagraph.children[0];
    if (!firstTextNode || firstTextNode.type !== "text") return;

    const match = firstTextNode.value.match(CALLOUT_REGEX);
    if (!match) return;

    const [_, type, foldable] = match;
    if (!type) return;

    // Standardize metadata
    const calloutType = type.toLowerCase();
    const isCollapsible = !!foldable;
    const isCollapsed = foldable === "-";

    const titleChildren: PhrasingContent[] = [];

    const tagMatch = firstTextNode.value.match(/^\[!([\w-]+)\]([+-]?)/);
    if (!tagMatch) return; // Should not happen given previous check
    const tagLength = tagMatch[0].length;

    // Remove the tag from the first text node. What remains is the start of the title.
    // Example: "[!info] My Title" -> " My Title"
    firstTextNode.value = firstTextNode.value.slice(tagLength);

    // Iterate over the paragraph children to build the title array
    // untill we hit a newline or a break.
    while (firstParagraph.children.length > 0) {
      const nextNode = firstParagraph.children[0];

      if (nextNode?.type === "break") {
        // Explicit markdown break -> End of Title
        firstParagraph.children.shift();
        break;
      }

      if (nextNode?.type === "text") {
        const newlineIndex = nextNode.value.indexOf("\n");
        if (newlineIndex !== -1) {
          const titlePart = nextNode.value.slice(0, newlineIndex);
          const bodyPart = nextNode.value.slice(newlineIndex + 1);

          if (titlePart) {
            titleChildren.push({ type: "text", value: titlePart });
          }

          nextNode.value = bodyPart;

          break;
        }
      }

      // If it's a text node without newline, or other inline element (strong, em)
      // Move it to titleChildren and remove from paragraph
      titleChildren.push(nextNode as PhrasingContent);
      firstParagraph.children.shift();
    }

    // Check if we actually found a title.
    // We check if titleChildren is empty OR if it only contains whitespace
    const hasContent = titleChildren.some((child) => {
      if (child.type === "text") return child.value.trim().length > 0;
      return true; // Any non-text node (like bold) counts as content
    });

    if (!hasContent) {
      const fallbackTitle =
        calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
      // Clear any whitespace-only text nodes we might have collected
      titleChildren.length = 0;
      titleChildren.push({ type: "text", value: fallbackTitle });
    }

    if (firstParagraph.children.length === 0) {
      node.children.shift();
    }

    if (options.useMdxCallout) {
      const plainTitle = titleChildren
        .map((c) => ("value" in c ? c.value : ""))
        .join("");

      node.data = {
        ...node.data,
        ...options.customProps.callouts?.container,
        hName: "Callout", // Render as <Callout> component
        hProperties: {
          // @ts-expect-error hProperties should not exist on `node.data`
          ...node.data.hProperties,
          title: plainTitle,
          type: calloutType,
        },
      };

      return;
    }

    const iconSVG = options.callouts[calloutType] || DEFAULT_CALLOUTS.note;
    const iconHast = fromHtml(iconSVG, { fragment: true }).children[0];

    // Create the Icon Node wrapper
    const iconNode: Emphasis = {
      type: "emphasis",
      data: {
        hName: "div", // Render as `<div>` instead of `<em>`
        hProperties: {
          ...options.customProps.callouts?.icon,
          className:
            options.customProps.callouts?.icon?.className || "callout-icon",
        },
        hChildren: [iconHast],
      },
      children: [], // Leave MDAST children empty
    };

    // Create the title element
    const titleNode: Paragraph = {
      type: "paragraph",
      data: {
        hName: isCollapsible ? "summary" : "div",
        hProperties: {
          ...options.customProps.callouts?.title,
          className:
            options.customProps.callouts?.title?.className || "callout-title",
        },
      },
      children: [iconNode, ...titleChildren],
    };

    if (isCollapsible) {
      const collapseIconHast = fromHtml(options.calloutCollapseIcon, {
        fragment: true,
      }).children[0];

      const collapseIconNode: Emphasis = {
        type: "emphasis",
        data: {
          hName: "div", // Render as `<div>` instead of `<em>`
          hProperties: {
            ...options.customProps.callouts?.collapse,
            className:
              options.customProps.callouts?.collapse?.className ||
              "callout-collapse-icon",
          },
          hChildren: [collapseIconHast],
        },
        children: [], // Leave MDAST children empty
      };

      titleNode.children.push(collapseIconNode);
    }

    // Transform the blockquote into the container (<details> or <div>)
    node.data = {
      ...node.data,
      hName: isCollapsible ? "details" : "div",
      hProperties: {
        ...options.customProps.callouts?.container,
        className:
          options.customProps.callouts?.container?.className || "callout",
        ...(isCollapsible && { open: !isCollapsed }),
        "data-callout": calloutType,
      },
    };

    // Inject the title node at the very top of the callout
    node.children.unshift(titleNode);
  });
}

export const DEFAULT_CALLOUTS = {
  note: SVG_NOTE,
  abstract: SVG_TLDR,
  summary: SVG_TLDR,
  tldr: SVG_TLDR,
  info: SVG_INFO,
  todo: SVG_TODO,
  tip: SVG_TIP,
  hint: SVG_TIP,
  important: SVG_TIP,
  success: SVG_CHECK,
  check: SVG_CHECK,
  done: SVG_CHECK,
  question: SVG_HELP,
  help: SVG_HELP,
  faq: SVG_HELP,
  warning: SVG_WARNING,
  attention: SVG_WARNING,
  caution: SVG_WARNING,
  failure: SVG_CROSS,
  missing: SVG_CROSS,
  fail: SVG_CROSS,
  danger: SVG_ERROR,
  error: SVG_ERROR,
  bug: SVG_BUG,
  example: SVG_EXAMPLE,
  quote: SVG_CITE,
  cite: SVG_CITE,
} satisfies Record<string, string>;

export type DefaultCallout = [keyof typeof DEFAULT_CALLOUTS][number];
