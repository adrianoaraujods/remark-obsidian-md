import { imageSizeFromFile } from "image-size/fromFile";

import type { FileMetadata } from "./content-map.js";

export type ImageFileMetadata = FileMetadata & {
  type: "img";
  width: number;
  height: number;
};

const IMAGES_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
]);

export function hasImageExtension(ext: string) {
  return IMAGES_EXTENSIONS.has(ext);
}

export async function getImageDimensions(path: string) {
  try {
    const { height, width } = await imageSizeFromFile(path);

    return { height, width };
  } catch {
    return undefined;
  }
}
