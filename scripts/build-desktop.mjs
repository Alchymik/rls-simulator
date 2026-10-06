import { rmSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'server', 'dist-desktop');

rmSync(output, { recursive: true, force: true });
await build({
  absWorkingDir: root,
  entryPoints: ['server/src/index.ts'],
  outfile: 'server/dist-desktop/index.cjs',
  bundle: true,
  packages: 'bundle',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  define: { 'import.meta.dirname': '__dirname' },
  sourcemap: false,
  legalComments: 'eof',
});
