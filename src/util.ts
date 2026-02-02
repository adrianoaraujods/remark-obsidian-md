/**
 * Converts a string into a URL-friendly slug.
 *
 * @param {string} text - The string to be slugified.
 * @returns {string} A lowercase, hyphenated, URL-safe string.
 * @example
 * slugify("Hello World!");        // "hello-world"
 * slugify("crème brûlée");       // "creme-brulee"
 * slugify("myCamelCaseString");  // "my-camel-case-string"
 */
export function slugify(text: string): string {
  if (!text) return "";

  return (
    text
      .toString()
      .trim()
      // 1. Handle camelCase (e.g., "myPostTitle" -> "my Post Title")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // 2. Normalize accents (e.g., "é" -> "e")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // 3. Lowercase everything
      .toLowerCase()
      // 4. Replace all non-alphanumeric chars with a hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // 5. Remove leading/trailing hyphens and prevent double hyphens
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  );
}
