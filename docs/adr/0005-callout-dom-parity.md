# Callouts emit Obsidian's reading-view DOM

Callouts reproduce Obsidian's DOM exactly: `div.callout[data-callout]` for non-foldable callouts and `details.callout.is-collapsible[open?]` for foldable ones, with `.callout-title`, `.callout-title-inner` and `.callout-content`. Icons are emitted as `.callout-title-icon[data-icon]` instead of inline Lucide SVGs, leaving the glyph itself to the theme.

## Considered options

- **`<details>` for every callout**: uniform markup, rejected because a non-foldable callout becomes a fake disclosure affordance that is togglable by mouse and keyboard and can only be suppressed with CSS.
- **Non-standard `blockquote[data-callout]`** (as some third-party plugins do): rejected because Obsidian theme CSS and snippets target `.callout`, so themes would break.

## Consequences

Existing Obsidian themes and CSS snippets apply to rendered callouts; the icon glyph is a theme responsibility.
