// Rebuilds media/mermaid.min.js from pinned npm deps.
//
// Vendored mermaid (v11) ships only the dagre layout; ELK lives in the
// external package @mermaid-js/layout-elk. This bundles both (plus elkjs)
// into one IIFE so webviews keep a single <script> include with no CDN.
//
// Run: npm run build:mermaid   (requires network for npm install)

import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

buildSync({
    entryPoints: [join(root, 'scripts', 'mermaid-bundle.entry.mjs')],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: join(root, 'media', 'mermaid.min.js'),
    logLevel: 'info',
});
