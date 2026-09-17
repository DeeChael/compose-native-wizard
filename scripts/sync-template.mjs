// Copies the compose-native template project into public/template/ so the
// wizard can fetch it at runtime, and writes a manifest.json listing every
// file (with a binary flag). Binary files are bundled verbatim by the wizard;
// text files go through the transformation pipeline.
//
// Usage: node scripts/sync-template.mjs [templateDir]
//        TEMPLATE_DIR env var is used when no argument is given.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const templateDir = resolve(
  process.argv[2] ?? process.env.TEMPLATE_DIR ?? join(root, '..', '..', 'kotlin', 'compose-native-template'),
);
const outDir = join(root, 'public', 'template');

if (!existsSync(templateDir)) {
  console.error(`Template directory not found: ${templateDir}`);
  process.exit(1);
}

const EXCLUDED_DIRS = new Set(['.git', '.gradle', '.idea', 'build', '.kotlin']);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function isBinary(path) {
  const buf = readFileSync(path);
  const probe = buf.subarray(0, 8192);
  return probe.includes(0);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const files = walk(templateDir).sort();
const manifest = [];
for (const full of files) {
  const rel = relative(templateDir, full).split('\\').join('/');
  const dest = join(outDir, rel);
  mkdirSync(join(dest, '..'), { recursive: true });
  cpSync(full, dest);
  manifest.push({
    path: rel,
    binary: isBinary(full),
    // The template ships gradlew without the exec bit; force it so generated
    // projects can run ./gradlew out of the box.
    executable: (statSync(full).mode & 0o111) !== 0 || basename(full) === 'gradlew',
  });
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ files: manifest }, null, 2) + '\n');
console.log(`Synced ${manifest.length} files from ${templateDir} -> ${relative(root, outDir)}`);
