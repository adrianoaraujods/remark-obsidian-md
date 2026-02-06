import { fromHtml } from "hast-util-from-html";
import type {
  Blockquote,
  Emphasis,
  Paragraph,
  PhrasingContent,
  Root,
} from "mdast";
import { visit } from "unist-util-visit";
import type { Options } from "./types.js";
import { CALLOUT_REGEX } from "./utils.js";

export function processCallouts(
  tree: Root,
  options: Required<
    Pick<Options, "useMdxCallout" | "customProps" | "callouts">
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
      const collapseIconHast = fromHtml(SVG_ARROW_RIGHT, { fragment: true })
        .children[0];

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

const SVG_ARROW_RIGHT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const SVG_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const SVG_TLDR =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>';
const SVG_TIP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
const SVG_CROSS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
const SVG_WARNING =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const SVG_HELP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const SVG_ERROR =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
const SVG_CITE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>';
const SVG_NOTE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="2" x2="22" y2="6"></line><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"></path></svg>';
const SVG_INFO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
const SVG_TODO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>';
const SVG_BUG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="14" x="8" y="6" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path><path d="m10 4 1 2"></path><path d="m14 4-1 2"></path></svg>';
const SVG_EXAMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';

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
