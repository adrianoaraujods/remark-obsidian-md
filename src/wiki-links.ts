import fs from "node:fs";
import path from "node:path";
import type { PhrasingContent, Root } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";
import type { Processor } from "unified";

import { transformTree } from "./transform-tree.js";
import type { Options } from "./types.js";
import { WIKI_LINK_REGEX } from "./utils.js";

export function processWikiLinks(
  processor: Processor,
  tree: Root,
  options: Required<Options>,
) {
  const { contentMap, customProps, root, slugify, urlPrefix } = options;

  findAndReplace(tree, [
    [
      WIKI_LINK_REGEX,
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

        // CASE 2: WikiLink (File Not found)
        if (!metadata) {
          return {
            type: "link",
            url: "#",
            children: [{ type: "text", value: label }],
            data: { hProperties: customProps.notFoundWikiLinks },
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
                ...customProps.imageEmbeds,
                src: metadata.path,
                alt: altText,
                width: metadata.width,
                height: metadata.height,
                style: resized ? `width:${alias}px;` : undefined,
              },
            },
          };
        }

        // CASE 4: WikiLink to Image
        if (!isEmbed && isImage) {
          return {
            type: "link",
            url: metadata.path,
            children: [{ type: "text", value: label }],
            data: { hProperties: customProps.imageLinks },
          };
        }

        // CASE 5: Embed Text File WikiLink (Recursive Logic)
        if (isEmbed && !isImage) {
          if (!options.enableEmbeds) return null;

          try {
            const absolutePath = path.resolve(`${root}/${metadata.path}`);
            const embedContent = fs.readFileSync(absolutePath).toString();

            const embedTree = processor.parse(embedContent) as Root;

            transformTree(processor, embedTree, options);

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
          data: { hProperties: customProps.wikiLinks },
        };
      },
    ],
  ]);
}
