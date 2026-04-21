# `shell/` — App chrome

Components here wrap the **whole app**: root bootstrap, layout, header, navigation, theme, and docked panels. They get the `shell-` prefix in the DOM (e.g. `shell-app`, `shell-global-header`).

**Use this namespace for:**

- The root component mounted from `src/index.js` (`shell-app`)
- Global layout and navigation—not screens tied to a single route
- Anything that is **not** a `page-*` view and **not** a reusable `ui-*` brick

**Do not use for:** route-level views (`page/`) or generic reusable widgets (`ui/`).

**Example:** The existing `app/` folder is the shell root; add sibling folders only for other chrome pieces (header, nav, etc.).
