# Hybrid tokenization: micromark for inline, MDAST for block

Obsidian's inline constructs (Wiki Link, Embed, Highlight, inline Comment, inline Footnote) are implemented as micromark inline extensions, so they fire correctly in every phrasing context — table cells, callout bodies, headings, list items, emphasis — and respect escaping and code. Block-level constructs (Callout, Block ID, block Comment) are implemented as MDAST transforms over already-parsed nodes.

## Considered options

- **Pure micromark**: most uniform, but block constructs that must consume raw markdown (multi-line `%%…%%` that may contain blank lines and markdown) are awkward and add little over a transform.
- **Pure MDAST post-processing**: simplest, but cannot respect escaping (`\|` in tables) and mis-handles constructs nested inside link text.

## Consequences

Wiki Links inside standard link text are not tokenized (they render literally), avoiding nested `<a>` elements.
