import fs from "node:fs";
import path from "node:path";

import {
  getImageDimensions,
  hasImageExtension,
  type ImageFileMetadata,
} from "./images.js";

export type FileMetadata = {
  path: string;
};

type MarkdownFileMetadata = FileMetadata & { type: "md" };

export type ContentMetadata = MarkdownFileMetadata | ImageFileMetadata;

// Global cache to prevent re-scanning the entire directory on every file change
let contentMap: Map<string, ContentMetadata> | null = null;

export async function getContentMap(
  rootDir: string,
): Promise<Map<string, ContentMetadata>> {
  if (contentMap !== null) return contentMap;

  const map = new Map<string, ContentMetadata>();
  const publicAbsPath = path.resolve(process.cwd(), rootDir);

  const stack = [publicAbsPath];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir || !fs.existsSync(currentDir)) continue;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();

      const relativePath = `/${path
        .relative(publicAbsPath, fullPath)
        .replace(/\\/g, "/")}`;

      if (hasImageExtension(ext)) {
        const dimensions = await getImageDimensions(fullPath);
        if (!dimensions) continue;

        map.set(entry.name.toLowerCase(), {
          type: "img",
          path: relativePath,
          width: dimensions.width,
          height: dimensions.height,
        });

        continue;
      }

      if (ext !== ".md") continue;

      const fileBaseName = path.parse(entry.name).name.toLowerCase();
      map.set(fileBaseName, { type: "md", path: relativePath });
    }
  }

  contentMap = map;
  return contentMap;
}
