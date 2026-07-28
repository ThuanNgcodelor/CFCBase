import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const localModules = resolve(projectRoot, 'node_modules');
const workspaceModules = resolve(projectRoot, '../frontend/node_modules');
const moduleRoot = existsSync(resolve(localModules, 'react'))
  ? localModules
  : workspaceModules;

const packageEntry = (packageName, entry = 'index.js') =>
  resolve(moduleRoot, packageName, entry);

export default {
  root: projectRoot,
  base: './',
  resolve: {
    alias: [
      { find: /^react$/, replacement: packageEntry('react') },
      { find: /^react\/jsx-runtime$/, replacement: packageEntry('react', 'jsx-runtime.js') },
      { find: /^react-dom$/, replacement: packageEntry('react-dom') },
      { find: /^react-dom\/client$/, replacement: packageEntry('react-dom', 'client.js') },
      { find: /^lucide-react$/, replacement: packageEntry('lucide-react', 'dist/cjs/lucide-react.js') }
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
    fs: {
      allow: [projectRoot, resolve(projectRoot, '..')]
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4179,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
};
