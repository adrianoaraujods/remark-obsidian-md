import type { Processor } from "unified";

/** Appends a micromark/from-markdown extension to the processor data. */
export function addExtension(
  processor: Processor,
  field: string,
  value: unknown,
): void {
  const data = processor.data() as Record<string, unknown>;
  if (!data[field]) data[field] = [];
  (data[field] as unknown[]).push(value);
}
