import fs from "node:fs";
import path from "node:path";
import type { Paragraph, PhrasingContent, Root } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";
import type { Processor } from "unified";
import { visit } from "unist-util-visit";

import type { ContentMetadata } from "./content-map.js";

type IncludeNode = {
  type: "mdxJsxTextElement";
  name: "include";
  data: { tree: Root };
};

export function processWikiLinks(
  tree: Root,
  rootDir: string,
  contentMap: Map<string, ContentMetadata>,
  processor: Processor<Root | undefined>,
  slugify: (text: string) => string,
  notFoundLinkProps: Record<string, string>,
  urlPrefix?: string,
) {
  function transformTree(currentTree: Root) {
    findAndReplace(currentTree, [
      [
        /(!)?\[\[(.*?)\]\]/g,
        (_: string, embed: string, content: string) => {
          const pipeIndex = content.indexOf("|");

          let rawTarget = "";
          let alias: string | undefined;

          if (pipeIndex === -1) {
            rawTarget = content;
          } else {
            rawTarget = content.slice(0, pipeIndex);
            alias = content.slice(pipeIndex + 1).trim();
          }

          // Clean up whitespace and normalize slashes
          rawTarget = rawTarget.replace(/\\/g, "/").trim();
          if (!rawTarget || rawTarget === "") return false;

          let [target, anchor] = rawTarget.split("#");
          target = target ? target.trim() : "";
          anchor = anchor ? anchor.trim() : undefined;
          const label = alias || rawTarget;

          // CASE 1: Standard WikiLink to Heading
          if (anchor && target === "") {
            const slugifiedUrl = `#${slugify(anchor)}`;

            return {
              type: "link",
              url: slugifiedUrl,
              children: [{ type: "text", value: label }],
            };
          }

          const metadata = contentMap.get(target.toLocaleLowerCase());

          // CASE 2: Broken Link
          if (!metadata) {
            return {
              type: "link",
              url: "#",
              children: [{ type: "text", value: label }],
              data: { hProperties: notFoundLinkProps },
            };
          }

          const isImage = metadata.type === "img";
          const isEmbed = embed === "!";

          // CASE 3: Embed Image
          if (isEmbed && isImage) {
            const resized = !Number.isNaN(Number(alias));
            const altText = resized ? target : label;

            return {
              type: "image",
              url: metadata.path,
              alt: altText,
              data: {
                hProperties: {
                  src: metadata.path,
                  alt: altText,
                  width: metadata.width,
                  height: metadata.height,
                  style: resized ? `width:${alias}px;` : undefined,
                },
              },
            };
          }

          // CASE 4: WikiLink to Image (Link only)
          if (!isEmbed && isImage) {
            return {
              type: "link",
              url: metadata.path,
              children: [{ type: "text", value: label }],
            };
          }

          // CASE 5: Embed WikiLink to Text File (Recursive Logic)
          if (isEmbed && !isImage) {
            try {
              const absolutePath = path.resolve(`${rootDir}/${metadata.path}`);
              const embedContent = fs.readFileSync(absolutePath).toString();

              const embedTree = processor.parse(embedContent) as Root;

              transformTree(embedTree);

              return {
                type: "mdxJsxTextElement",
                name: "include",
                attributes: [],
                children: [],
                data: { tree: embedTree },
              } as unknown as PhrasingContent;
            } catch (error) {
              console.error(`Failed to embed ${target}:`, error);
              return null;
            }
          }

          // CASE 6: Standard WikiLink to Text File
          const slugifiedUrl = `${urlPrefix ? `${urlPrefix}/` : ""}${metadata.path
            .replace(/\.mdx?$/, "")
            .split("/")
            .map((part) => slugify(part))
            .join("/")}${anchor ? `#${slugify(anchor)}` : ""}`;

          return {
            type: "link",
            url: slugifiedUrl,
            children: [{ type: "text", value: label }],
          };
        },
      ],
    ]);

    // Post-Processing: Flatten `<include>` nodes
    visit(currentTree, "paragraph", (node: Paragraph, index, parent) => {
      if (!parent || typeof index !== "number") return;

      if (node.children.length === 1) {
        const child = node.children[0] as unknown as IncludeNode;

        if (child.type === "mdxJsxTextElement" && child.name === "include") {
          const embedTree = child.data?.tree;

          if (embedTree) {
            parent.children.splice(index, 1, ...embedTree.children);
            return index + embedTree.children.length;
          }
        }
      }
    });
  }

  transformTree(tree);
}
