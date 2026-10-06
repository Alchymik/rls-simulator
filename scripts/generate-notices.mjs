import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages;
const visited = new Set();
const locate = (parent, name) => {
  let directory = parent;
  while (true) {
    const candidate = directory ? `${directory}/node_modules/${name}` : `node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!directory) throw new Error(`Missing production dependency ${name} from ${parent}`);
    const next = path.posix.dirname(directory);
    directory = next === '.' ? '' : next;
  }
};
const collect = (parent) => {
  for (const name of Object.keys(packages[parent].dependencies ?? {})) {
    const key = locate(parent, name);
    if (visited.has(key)) continue;
    visited.add(key);
    collect(key);
  }
};
collect('client');
collect('server');
const notices = [
  'Third-party software notices',
  'Generated from installed production dependencies; Electron includes its own LICENSE and LICENSES.chromium.html.',
];
for (const directory of [...visited].sort()) {
  const folder = path.join(root, directory);
  const manifest = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
  notices.push(
    `\n${'='.repeat(72)}\n${manifest.name} ${manifest.version}\nLicense: ${JSON.stringify(manifest.license ?? 'See package documentation')}`,
  );
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const files = entries.filter(
    (entry) =>
      entry.isFile() &&
      !path.relative(folder, entry.parentPath).split(path.sep).includes('node_modules') &&
      /^(licen[cs]e|copying|notice)([.-]|$)/i.test(entry.name),
  );
  if (!files.length) {
    const readme = await readFile(path.join(folder, 'README.md'), 'utf8');
    const heading = /^(?:#+\s*)?Licen[cs]es?\s*$/im.exec(readme);
    if (!heading) throw new Error(`No license notice found for ${manifest.name}`);
    notices.push(readme.slice(heading.index));
  }
  for (const file of files) notices.push(await readFile(path.join(file.parentPath, file.name), 'utf8'));
}
const content = notices.join('\n\n') + '\n';
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.txt'), content);
await mkdir(path.join(root, 'client/dist'), { recursive: true });
await writeFile(path.join(root, 'client/dist/THIRD_PARTY_NOTICES.txt'), content);
console.log(`Included license notices for ${visited.size} production packages.`);
