// Loads the synced template (public/template/) over HTTP into an in-memory file set.

import type { FileSet } from './transform';

export interface ManifestEntry {
  path: string;
  binary: boolean;
  executable: boolean;
}

export interface TemplateData {
  files: FileSet;
  /** Paths that need the executable bit in the generated zip (e.g. gradlew). */
  executables: Set<string>;
}

const baseUrl = `${import.meta.env.BASE_URL}template`;

export async function loadTemplate(): Promise<TemplateData> {
  const manifestRes = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`模板清单加载失败（HTTP ${manifestRes.status}），请先运行 npm run sync-template`);
  }
  const manifest = (await manifestRes.json()) as { files: ManifestEntry[] };

  const files: FileSet = new Map();
  const executables = new Set<string>();

  await Promise.all(
    manifest.files.map(async (entry) => {
      const res = await fetch(`${baseUrl}/${entry.path.split('/').map(encodeURIComponent).join('/')}`);
      if (!res.ok) throw new Error(`模板文件加载失败: ${entry.path}（HTTP ${res.status}）`);
      files.set(entry.path, new Uint8Array(await res.arrayBuffer()));
      if (entry.executable) executables.add(entry.path);
    }),
  );

  return { files, executables };
}
