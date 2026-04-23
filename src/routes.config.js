/**
 * Single source of truth for app routes.
 * Consumed by router.js (matching, titles) and app (nav maps, nav items).
 *
 * Fields:
 *   path       - URL pattern (use :param for dynamic segments)
 *   component  - LWC component name (must be registered in app.js ROUTE_COMPONENTS)
 *   title      - Document title (string or (params) => string)
 *   navPage    - Id for nav active state and navigate({ page }) (omit to hide from nav)
 *   navLabel   - Label shown in nav bar and waffle
 *   navPath    - Optional; for dynamic routes, path used in nav links (e.g. /users/42)
 *   navHighlight - Optional; nav page id to highlight when this route is active (for child routes that don't create a tab)
 */

export const routes = [
  {
    path: '/',
    component: 'page-home',
    title: 'Home',
  },
  {
    path: '/lobby',
    component: 'page-lobby-management',
    title: 'Service Territory',
    navPage: 'lobby',
    navLabel: 'Lobby Management',
  },
  {
    path: '/icons',
    component: 'page-icon-test',
    title: 'Icons',
  },
  {
    path: '/settings',
    component: 'page-settings',
    title: 'Settings',
  },
  {
    path: '/users/:id',
    component: 'page-user',
    title: (params) => `User ${params.id}`,
  },
  {
    path: '/contacts',
    component: 'page-contacts',
    title: 'Contacts',
  },
  {
    path: '/contacts/:id',
    component: 'page-contact-detail',
    title: (params) => `Contact ${params.id}`,
  },
];
