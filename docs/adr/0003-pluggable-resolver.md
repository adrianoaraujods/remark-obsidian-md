# Pluggable resolver with Obsidian resolution semantics

Link and Embed targets are resolved through a pluggable `Resolver` whose `resolve(target)` returns a discriminated union keyed by `kind` (`"note"` | `"asset"`), backed by a filesystem-scan built-in and a caller-supplied-map built-in. Resolution is global and source-agnostic, case-insensitive, extension-optional, and uses root-wins-on-duplicate to match Obsidian, where the path is unique and the "shortest path" setting only affects link *generation*. URL generation (`slugify`, `urlPrefix`, heading anchors) stays a separate concern.

## Considered options

- **Require a caller-supplied map** (no filesystem coupling): clean, but loses the zero-config default.
- **Filesystem scan only**: simple, but untestable without a real vault and unusable in bundlers/CI.

## Consequences

Subpath (`#Heading` / `#^block-id`) validation lives in the link/embed transform, not the resolver, because the transform already parses the target it needs to slice.
