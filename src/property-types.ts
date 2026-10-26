import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isPlainObject } from "./utils.js";

/**
 * Obsidian's property type map: property name → the type set in the app
 * (`"text"`, `"number"`, `"checkbox"`, `"date"`, `"datetime"`, `"tags"`,
 * `"aliases"`, `"multitext"`, …).
 */
export type PropertyTypes = Record<string, string>;

/**
 * Reads the property types Obsidian keeps in `<vault>/.obsidian/types.json`,
 * so consumers can honour the types set in the app. Returns an empty map when
 * the file is missing or malformed; untyped properties then fall back to
 * default detection.
 */
export function filesystemPropertyTypes(vault: string): PropertyTypes {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(join(vault, ".obsidian", "types.json"), "utf8"),
    );
    const types = isPlainObject(raw) ? raw.types : undefined;
    if (!isPlainObject(types)) return {};

    const result: PropertyTypes = {};
    for (const [key, value] of Object.entries(types)) {
      if (typeof value === "string") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}
