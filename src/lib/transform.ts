// Pure transformation pipeline: template file set + wizard options -> new file set.
// Paths are relative to the template root (e.g. "composeApp/build.gradle.kts").

import { PLATFORMS, resolveLibrarySelection } from './config';

export interface WizardOptions {
  projectName: string;
  packageName: string;
  windowTitle: string;
  /** packageOfResClass for compose resources; defaults to `${packageName}.generated.resources`. */
  resourcesPackage?: string;
  /** Selected platform ids (subset of PLATFORMS, at least one). */
  platforms: string[];
  /** Selected library ids (requires-closure is applied here). */
  libraries: string[];
}

export type FileSet = Map<string, Uint8Array>;

const TEMPLATE_PACKAGE = 'com.example.cmpn';
const TEMPLATE_PACKAGE_PATH = 'com/example/cmpn';
const DEFAULT_WINDOW_TITLE = 'Compose Multiplatform Native';

/** Catalog keys that are always kept (template core, not user-selectable). */
const CORE_VERSION_KEYS = ['androidx-lifecycle', 'composeMultiplatform', 'kotlin', 'material3', 'compose-desktop-native'];
const CORE_LIBRARY_KEYS = [
  'kotlin-test',
  'androidx-lifecycle-viewmodelCompose',
  'androidx-lifecycle-runtimeCompose',
  'compose-runtime',
  'compose-foundation',
  'compose-material3',
  'compose-ui',
  'compose-components-resources',
  'compose-desktopNativeWindow',
];
const CORE_PLUGIN_KEYS = [
  'composeMultiplatform',
  'composeCompiler',
  'kotlinJvm',
  'kotlinMultiplatform',
  'composeDesktopNativeBridge',
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function decode(files: FileSet, path: string): string {
  const data = files.get(path);
  if (data === undefined) throw new Error(`Template file missing: ${path}`);
  return textDecoder.decode(data);
}

function encode(files: FileSet, path: string, content: string): void {
  files.set(path, textEncoder.encode(content));
}

export function transformTemplate(template: FileSet, options: WizardOptions): FileSet {
  if (options.platforms.length === 0) throw new Error('至少需要选择一个目标平台');
  const files: FileSet = new Map(template);
  const selected = new Set(options.platforms);

  removeUnselectedSourceSets(files, selected);
  rewriteCatalog(files, options);
  rewriteAppBuildGradle(files, options);
  rewriteRootBuildGradle(files, options);
  rewriteSettingsGradle(files, options);
  rewriteGradleProperties(files, selected);
  rewriteReadme(files, options);
  rewriteWindowTitle(files, options);
  renamePackage(files, options.packageName);
  renameResourcesPackage(files, options);

  return files;
}

/** Deletes <target>Main source-set directories of unselected platforms. */
function removeUnselectedSourceSets(files: FileSet, selected: Set<string>): void {
  for (const platform of PLATFORMS) {
    if (selected.has(platform.id)) continue;
    const prefix = `composeApp/src/${platform.id}Main/`;
    for (const path of [...files.keys()]) {
      if (path.startsWith(prefix)) files.delete(path);
    }
  }
}

/** Rebuilds gradle/libs.versions.toml from scratch: keeps the core entries and
 *  the selected libraries' entries, drops everything else (including all
 *  comments and orphaned version keys like knbt), and appends catalog entries
 *  for selected libraries that are not in the template catalog. */
function rewriteCatalog(files: FileSet, options: WizardOptions): void {
  const path = 'gradle/libs.versions.toml';
  const content = decode(files, path);

  const versions = new Map<string, string>();
  const libraries = new Map<string, { module: string; versionRef: string }>();
  const plugins = new Map<string, { id: string; versionRef: string }>();
  let section = '';
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '[versions]' || line === '[libraries]' || line === '[plugins]') {
      section = line;
      continue;
    }
    let m: RegExpMatchArray | null;
    if (section === '[versions]' && (m = line.match(/^(\S+)\s*=\s*"([^"]*)"$/))) {
      versions.set(m[1], m[2]);
    } else if (
      section === '[libraries]' &&
      (m = line.match(/^(\S+)\s*=\s*\{\s*module\s*=\s*"([^"]*)",\s*version\.ref\s*=\s*"([^"]*)"\s*\}$/))
    ) {
      libraries.set(m[1], { module: m[2].trim(), versionRef: m[3] });
    } else if (
      section === '[plugins]' &&
      (m = line.match(/^(\S+)\s*=\s*\{\s*id\s*=\s*"([^"]*)",\s*version\.ref\s*=\s*"([^"]*)"\s*\}$/))
    ) {
      plugins.set(m[1], { id: m[2], versionRef: m[3] });
    }
  }

  const selected = resolveLibrarySelection(options.libraries);
  const keepLibraryKeys = new Set(CORE_LIBRARY_KEYS);
  const keepPluginKeys = new Set(CORE_PLUGIN_KEYS);
  const addedVersions = new Map<string, string>();
  const addedLibraries = new Map<string, { module: string; versionRef: string }>();
  for (const lib of selected) {
    lib.dependencies.forEach((d) => keepLibraryKeys.add(d.replaceAll('.', '-')));
    (lib.plugins ?? []).forEach((p) => keepPluginKeys.add(p));
    const entries = lib.catalogEntries ?? [];
    if (entries.length === 0) continue;
    const versionKey = lib.catalogVersionKey;
    if (!versionKey) throw new Error(`库 ${lib.id} 缺少 catalogVersionKey`);
    if (!versions.has(versionKey) && !addedVersions.has(versionKey)) {
      addedVersions.set(versionKey, lib.version);
    }
    for (const entry of entries) {
      if (!libraries.has(entry.key) && !addedLibraries.has(entry.key)) {
        addedLibraries.set(entry.key, { module: entry.module, versionRef: versionKey });
      }
    }
  }

  const finalLibraries = new Map([...libraries].filter(([k]) => keepLibraryKeys.has(k)));
  for (const [k, v] of addedLibraries) finalLibraries.set(k, v);
  const finalPlugins = new Map([...plugins].filter(([k]) => keepPluginKeys.has(k)));

  const keepVersionKeys = new Set<string>(CORE_VERSION_KEYS);
  for (const { versionRef } of finalLibraries.values()) keepVersionKeys.add(versionRef);
  for (const { versionRef } of finalPlugins.values()) keepVersionKeys.add(versionRef);
  const finalVersions = new Map([...versions].filter(([k]) => keepVersionKeys.has(k)));
  for (const [k, v] of addedVersions) {
    if (!finalVersions.has(k)) finalVersions.set(k, v);
  }

  const lines = ['[versions]'];
  for (const [k, v] of finalVersions) lines.push(`${k} = "${v}"`);
  lines.push('', '[libraries]');
  for (const [k, { module, versionRef }] of finalLibraries) {
    lines.push(`${k} = { module = "${module}", version.ref = "${versionRef}" }`);
  }
  lines.push('', '[plugins]');
  for (const [k, { id, versionRef }] of finalPlugins) {
    lines.push(`${k} = { id = "${id}", version.ref = "${versionRef}" }`);
  }
  encode(files, path, lines.join('\n') + '\n');
}

/** Rewrites the kotlin { buildList { ... }.forEach { ... } } target block.
 *  macosArm64 (when selected) is added unconditionally; the other targets are
 *  gated behind `if (!isMacOS)` so a macOS dev machine only compiles the Mac
 *  target, while other hosts build everything selected. When macosArm64 is not
 *  selected, the remaining targets are added unconditionally (no host gate). */
function buildTargetBlock(platforms: string[]): string {
  const TARGET_ORDER = ['macosArm64', 'linuxArm64', 'linuxX64', 'mingwX64'];
  const selected = TARGET_ORDER.filter((t) => platforms.includes(t));
  const hasMac = selected.includes('macosArm64');
  const nonMac = selected.filter((t) => t !== 'macosArm64');

  const branches: string[] = [];
  if (platforms.includes('mingwX64')) {
    branches.push(`                    target.name == "mingwX64" -> linkerOpts(
                        // crypt32: client-cert (mTLS) import into the Windows cert store.
                        "-lcrypt32",
                        "-Wl,--gc-sections", "-Wl,-s",
                        // GUI subsystem (no console window), keeping the C \`main\` entry.
                        "-Wl,--subsystem,windows", "-Wl,-e,mainCRTStartup",
                    )`);
  }
  if (platforms.some((p) => p.startsWith('linux'))) {
    branches.push(`                    target.name.startsWith("linux") -> linkerOpts(
                        "-L/usr/lib/x86_64-linux-gnu", "-L/usr/lib/aarch64-linux-gnu",
                        "-lfontconfig", "-lGL", "-lX11",
                    )`);
  }

  const whenBlock =
    branches.length > 0 ? `\n                when {\n${branches.join('\n\n')}\n                }` : '';

  let addLines: string;
  let hostGate = '';
  if (hasMac && nonMac.length > 0) {
    hostGate = `    val hostOs = System.getProperty("os.name")
    val isMacOS = hostOs == "Mac OS X"

`;
    addLines = [
      `        add(macosArm64())`,
      `        if (!isMacOS) {`,
      ...nonMac.map((t) => `            add(${t}())`),
      `        }`,
    ].join('\n');
  } else {
    addLines = selected.map((t) => `        add(${t}())`).join('\n');
  }

  return `${hostGate}    buildList {
${addLines}
    }.forEach {
        it.binaries {
            executable {${whenBlock}
            }
        }
    }
`;
}

function rewriteAppBuildGradle(files: FileSet, options: WizardOptions): void {
  const path = 'composeApp/build.gradle.kts';
  let content = decode(files, path);

  // 1. Replace the target-declaration block (from "buildList {" up to the
  //    first line that is exactly 4 spaces + "}", which closes .forEach).
  const targetBlockRe = /    buildList \{[\s\S]*?\n    \}\n/;
  if (!targetBlockRe.test(content)) throw new Error('无法在 composeApp/build.gradle.kts 中定位 target 声明块');
  content = content.replace(targetBlockRe, buildTargetBlock(options.platforms));

  // 1.5. The SDL dependency comes in transitively; drop the explicit import.
  content = content.replace('            implementation(libs.compose.sdl)\n', '');

  // 2. Inject selected libraries into commonMain.dependencies.
  const libraries = resolveLibrarySelection(options.libraries);
  const dependencies = [
    ...new Set([
      ...libraries.map((l) => l.dependencies.map((d) => `implementation(libs.${d})`)).flat(),
      ...libraries
        .map((l) =>
          (l.catalogEntries ?? []).map(
            (e) => `${e.inject ?? 'implementation'}(libs.${e.key.replaceAll('-', '.')})`,
          ),
        )
        .flat(),
    ]),
  ];
  if (dependencies.length > 0) {
    const depLines = dependencies.map((d) => `            ${d}`).join('\n');
    const anchor = '            implementation(libs.compose.desktopNativeWindow)\n';
    if (!content.includes(anchor)) throw new Error('无法在 composeApp/build.gradle.kts 中定位依赖注入点');
    content = content.replace(anchor, `${anchor}\n${depLines}\n`);
  }

  // 3. Apply extra plugins required by the selected libraries.
  const plugins = [...new Set(libraries.flatMap((l) => l.plugins ?? []))];
  if (plugins.length > 0) {
    const pluginLines = plugins.map((p) => `    alias(libs.plugins.${p})`).join('\n');
    const anchor = '    alias(libs.plugins.composeDesktopNativeBridge)\n}';
    if (!content.includes(anchor)) throw new Error('无法在 composeApp/build.gradle.kts 中定位插件块');
    content = content.replace(anchor, `    alias(libs.plugins.composeDesktopNativeBridge)\n${pluginLines}\n}`);
  }

  encode(files, path, content);
}

/** Adds `apply false` entries for extra plugins to the root build script. */
function rewriteRootBuildGradle(files: FileSet, options: WizardOptions): void {
  const path = 'build.gradle.kts';
  const libraries = resolveLibrarySelection(options.libraries);
  const plugins = [...new Set(libraries.flatMap((l) => l.plugins ?? []))];
  if (plugins.length === 0) return;

  let content = decode(files, path);
  const pluginLines = plugins.map((p) => `    alias(libs.plugins.${p}) apply false`).join('\n');
  const anchor = '    alias(libs.plugins.composeDesktopNativeBridge) apply false\n}';
  if (!content.includes(anchor)) {
    throw new Error('无法在根 build.gradle.kts 中定位插件块');
  }
  content = content.replace(
    anchor,
    `    alias(libs.plugins.composeDesktopNativeBridge) apply false\n${pluginLines}\n}`,
  );
  encode(files, path, content);
}

/** Sets rootProject.name (the template does not declare one). */
function rewriteSettingsGradle(files: FileSet, options: WizardOptions): void {
  const path = 'settings.gradle.kts';
  let content = decode(files, path);
  if (content.includes('rootProject.name')) {
    content = content.replace(/rootProject\.name\s*=\s*"[^"]*"/, `rootProject.name = "${options.projectName}"`);
  } else {
    content = content.replace(
      'include(":composeApp")',
      `rootProject.name = "${options.projectName}"\n\ninclude(":composeApp")`,
    );
  }
  encode(files, path, content);
}

/** Drops the experimental macOS flag when no macOS target is selected. */
function rewriteGradleProperties(files: FileSet, selected: Set<string>): void {
  if ([...selected].some((p) => p.startsWith('macos'))) return;
  const path = 'gradle.properties';
  let content = decode(files, path);
  content = content
    .replace(/\n?# macOS\norg\.jetbrains\.compose\.experimental\.macos\.enabled=true\n?/, '\n')
    .replace(/\n{3,}/g, '\n\n');
  encode(files, path, content);
}

function rewriteReadme(files: FileSet, options: WizardOptions): void {
  const path = 'README.md';
  const content = decode(files, path).replace(/^# .*$/m, `# ${options.projectName}`);
  encode(files, path, content);
}

function rewriteWindowTitle(files: FileSet, options: WizardOptions): void {
  const path = 'composeApp/src/nativeMain/kotlin/com/example/cmpn/Entrypoint.kt';
  const content = decode(files, path).replace(
    `title = "${DEFAULT_WINDOW_TITLE}"`,
    `title = "${options.windowTitle}"`,
  );
  encode(files, path, content);
}

/** Replaces the template package in file contents and directory paths. */
function renamePackage(files: FileSet, packageName: string): void {
  if (packageName === TEMPLATE_PACKAGE) return;
  const packagePath = packageName.split('.').join('/');

  const renamed: FileSet = new Map();
  for (const [path, data] of files) {
    let newPath = path;
    let newData = data;
    if (path.endsWith('.kt') || path.endsWith('.kts')) {
      const content = textDecoder.decode(data);
      if (content.includes(TEMPLATE_PACKAGE)) {
        newData = textEncoder.encode(content.split(TEMPLATE_PACKAGE).join(packageName));
      }
    }
    if (path.includes(TEMPLATE_PACKAGE_PATH)) {
      newPath = path.split(TEMPLATE_PACKAGE_PATH).join(packagePath);
    }
    renamed.set(newPath, newData);
  }
  files.clear();
  for (const [path, data] of renamed) files.set(path, data);
}

/** Rewrites packageOfResClass and its imports when a custom resources package
 *  is given (runs after renamePackage, so it replaces the default value). */
function renameResourcesPackage(files: FileSet, options: WizardOptions): void {
  const defaultPackage = `${options.packageName}.generated.resources`;
  const target = options.resourcesPackage?.trim() || defaultPackage;
  if (target === defaultPackage) return;
  for (const [path, data] of files) {
    if (!path.endsWith('.kt') && !path.endsWith('.kts')) continue;
    const content = textDecoder.decode(data);
    if (content.includes(defaultPackage)) {
      files.set(path, textEncoder.encode(content.split(defaultPackage).join(target)));
    }
  }
}
