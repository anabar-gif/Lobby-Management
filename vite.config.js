import { defineConfig } from 'vite';
import path from 'path';
import lwc from 'vite-plugin-lwc';
import {
  resolveIconTemplatesPlugin,
  iconTemplateExcludeDirs,
  iconTemplateAliases,
} from './vite-plugins/icon-templates.js';

export default defineConfig({
  base: './',
  plugins: [
    resolveIconTemplatesPlugin(),
    lwc({
      modules: [
        {
          dir: path.resolve('./src/modules'),
        },
        {
          name: '@salesforce/gate/bc.260.enableComboboxElementInternals',
          path: path.resolve('./src/build/shim/gateComboboxElementInternalsClosed.js'),
        },
        {
          npm: 'lightning-base-components',
        },
      ],
      disableSyntheticShadowSupport: false,
      enableDynamicComponents: true,
      exclude: [
        path.resolve('./index.html'),
        path.resolve('./src/build/generated'),
        // Global SLDS from node_modules (new URL in slds-loader.js) must not pass through LWC:
        // LWC rejects :root in this pipeline when synthetic shadow is enabled.
        /(salesforce-lightning-design-system\.min\.css|slds2\.cosmos\.css)(\?.*)?$/,
        ...iconTemplateExcludeDirs,
      ],
    }),
  ],
  appType: 'spa',
  server: {
    port: 3000,
    open: false,
  },
  optimizeDeps: {
    exclude: ['lightning/modal', 'lightning/primitiveOverlay', 'lightning/overlayUtils', 'lightning/modalBase', 'lightning/utilsPrivate'],
  },
  resolve: {
    alias: {
      '@salesforce-ux/design-system': path.resolve('./node_modules/@salesforce-ux/design-system'),
      '@salesforce-ux/design-system-2': path.resolve('./node_modules/@salesforce-ux/design-system-2'),
      ...iconTemplateAliases,
    },
  },
});
