# The Stylesheet is opt-in, class-scoped CSS that is never injected

The package ships plain CSS files (`styles.css`, plus `styles/base.css`, `styles/dark-media.css` and `styles/dark-class.css`) that a consumer imports explicitly. Every rule is scoped under a `markdown-rendered` class that the consumer puts on their own Rendered Container, through `:where()` so the rules add zero specificity. The plugin never injects CSS into the output and never wraps the content in an element, which keeps it framework-agnostic ([ADR 0001](./0001-framework-agnostic-mdast-output.md)) and leaves the consumer in control of the page's cascade.

## Considered options

- **Inject a `<style>` node or inline styles into the tree**: rejected because it pollutes the mdast/hast output, repeats per Note, breaks strict CSP setups and cannot be overridden without `!important`.
- **Wrap the content in an element carrying the class**: rejected because it adds a node the consumer did not ask for and fights their layout; the consumer already owns the element that holds the Note.
- **`@layer`**: rejected because layer support is newer than the plain selectors this relies on, and un-layered consumer CSS beats layered rules anyway, which `:where()` already achieves without a build-order requirement.

## Consequences

Consumers must import the CSS and add the class; forgetting either leaves the DOM unstyled, never broken. The class name and the import paths are public API and hard to change. Overriding needs no specificity tricks, and Tailwind is not required.
