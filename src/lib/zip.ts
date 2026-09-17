// Zips the generated file set with fflate and triggers a browser download.

import { zipSync } from 'fflate';
import type { FileSet } from './transform';

export function buildZip(files: FileSet, rootDir: string, executables: Set<string>): Uint8Array {
  const entries: Record<string, [Uint8Array, { attrs?: number; os?: number }]> = {};
  for (const [path, data] of files) {
    const zipPath = `${rootDir}/${path}`;
    if (executables.has(path)) {
      // Unix regular file with 0755 permissions (os: 3 = Unix).
      entries[zipPath] = [data, { attrs: (0o100755 << 16) | 0o644, os: 3 }];
    } else {
      entries[zipPath] = [data, {}];
    }
  }
  return zipSync(entries, { level: 6 });
}

export function downloadZip(data: Uint8Array, fileName: string): void {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
