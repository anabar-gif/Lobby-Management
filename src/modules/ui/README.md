# `ui/` — Lower-level / reusable components

Components in this folder are **building blocks** used by pages or other components. They get the `ui-` prefix in the DOM (e.g. `ui-card`, `ui-button`).

**Use this namespace for:**

- Reusable UI primitives (cards, buttons, modals, form controls)
- Shared layout or composition blocks
- Anything that is **not** a full route/view

**Example:** Add a folder `card/` here → use as `<ui-card>` in your templates.
