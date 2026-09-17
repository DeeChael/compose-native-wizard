// Option definitions for the wizard. Everything here mirrors the template's
// gradle/libs.versions.toml catalog and composeApp/build.gradle.kts targets.

export interface PlatformOption {
  /** Kotlin/Native target name, also the <id>Main source-set directory name. */
  id: string;
  name: string;
}

export const PLATFORMS: PlatformOption[] = [
  { id: 'linuxX64', name: 'Linux x64' },
  { id: 'linuxArm64', name: 'Linux ARM64' },
  { id: 'macosArm64', name: 'macOS ARM64' },
  { id: 'mingwX64', name: 'Windows x64' },
];

export interface CatalogEntry {
  /** toml library key, e.g. "koin-compose" -> accessor libs.koin.compose */
  key: string;
  /** group:artifact (the version comes from the option's catalogVersionKey). */
  module: string;
  /** Injection configuration; defaults to "implementation". */
  inject?: 'implementation' | 'ksp';
}

export interface LibraryOption {
  id: string;
  name: string;
  /** Catalog version, shown next to the name. */
  version: string;
  /** Maven coordinates shown in the UI, e.g. "cafe.adriel.voyager:voyager-navigator". */
  modules: string[];
  /** Version-catalog accessors already present in the template catalog,
   *  e.g. "voyager.navigator" -> libs.voyager.navigator */
  dependencies: string[];
  /** [versions] key backing catalogEntries (value = this.version); skipped when
   *  the key already exists in the template catalog (e.g. "voyager"). */
  catalogVersionKey?: string;
  /** Entries appended to gradle/libs.versions.toml [libraries] when selected. */
  catalogEntries?: CatalogEntry[];
  /** Plugin catalog names to apply (composeApp + root with apply false). */
  plugins?: string[];
  /** Other library ids that get selected automatically with this one. */
  requires?: string[];
  /** Satisfied when at least one of these ids is selected; otherwise the first
   *  one is offered in the confirm dialog. */
  requiresAny?: string[];
  /** Human label for the requiresAny group in the confirm dialog. */
  requiresAnyLabel?: string;
}

export interface LibraryGroup {
  id: string;
  name: string;
  options: LibraryOption[];
}

export const LIBRARY_GROUPS: LibraryGroup[] = [
  {
    id: 'ui',
    name: 'UI',
    options: [
      {
        id: 'material-icons',
        name: 'Material Icons Extended',
        version: '1.7.3',
        modules: ['org.jetbrains.compose.material:material-icons-extended'],
        dependencies: ['compose.material.materialIconsExtended'],
      },
      {
        id: 'haze-blur',
        name: 'haze (Blur)',
        version: '2.0.0-beta01',
        modules: [
          'dev.chrisbanes.haze:haze',
          'dev.chrisbanes.haze:haze-blur',
          'dev.chrisbanes.haze:haze-blur-materials',
          'dev.chrisbanes.haze:haze-blur-material3',
        ],
        dependencies: ['haze', 'haze.blur', 'haze.blur.materials', 'haze.blur.material3'],
      },
      {
        id: 'haze-glass',
        name: 'haze (Glass)',
        version: '2.0.0-beta01',
        modules: [
          'dev.chrisbanes.haze:haze',
          'dev.chrisbanes.haze:haze-glass',
          'dev.chrisbanes.haze:haze-glass-material3',
        ],
        dependencies: ['haze', 'haze.glass', 'haze.glass.material3'],
      },
      {
        id: 'coil',
        name: 'Coil3',
        version: '3.6.2',
        modules: [
          'io.coil-kt.coil3:coil-compose',
          'io.coil-kt.coil3:coil-network-ktor3',
          'io.coil-kt.coil3:coil-svg',
        ],
        dependencies: ['coil.compose', 'coil.network.ktor3', 'coil.svg'],
      },
    ],
  },
  {
    id: 'navigation',
    name: '导航',
    options: [
      {
        id: 'voyager-navigator',
        name: 'Voyager Navigator',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-navigator'],
        dependencies: ['voyager.navigator'],
      },
      {
        id: 'voyager-screenmodel',
        name: 'Voyager ScreenModel',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-screenmodel'],
        dependencies: ['voyager.screenModel'],
      },
      {
        id: 'voyager-bottom-sheet-navigator',
        name: 'Voyager BottomSheet Navigator',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-bottom-sheet-navigator'],
        dependencies: ['voyager.bottomSheetNavigator'],
      },
      {
        id: 'voyager-tab-navigator',
        name: 'Voyager Tab Navigator',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-tab-navigator'],
        dependencies: ['voyager.tabNavigator'],
      },
      {
        id: 'voyager-transitions',
        name: 'Voyager Transitions',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-transitions'],
        dependencies: ['voyager.transitions'],
      },
      {
        id: 'navigation3',
        name: 'Navigation 3',
        version: '1.1.0-alpha02',
        modules: ['androidx.navigation3:navigation3-runtime', 'androidx.navigation3:navigation3-ui'],
        dependencies: [],
        catalogVersionKey: 'navigation3',
        catalogEntries: [
          { key: 'navigation3-runtime', module: 'androidx.navigation3:navigation3-runtime' },
          { key: 'navigation3-ui', module: 'androidx.navigation3:navigation3-ui' },
        ],
      },
      {
        id: 'voyager-koin',
        name: 'Voyager Koin',
        version: '1.1.0-beta02',
        modules: ['cafe.adriel.voyager:voyager-koin'],
        dependencies: [],
        catalogVersionKey: 'voyager',
        catalogEntries: [{ key: 'voyager-koin', module: 'cafe.adriel.voyager:voyager-koin' }],
        requires: ['koin', 'voyager-navigator', 'voyager-screenmodel'],
      },
    ],
  },
  {
    id: 'network',
    name: '网络',
    options: [
      {
        id: 'ktor',
        name: 'Ktor Client',
        version: '3.5.2',
        modules: ['io.ktor:ktor-client-core', 'io.ktor:ktor-client-cio'],
        dependencies: ['ktor.client.core', 'ktor.client.cio'],
      },
      {
        id: 'ktorfit',
        name: 'Ktorfit',
        version: '2.7.5',
        modules: ['de.jensklingenberg.ktorfit:ktorfit-lib-light'],
        dependencies: ['ktorfit'],
        plugins: ['ksp', 'ktorfit'],
        requires: ['ktor'],
      },
    ],
  },
  {
    id: 'serialization',
    name: '序列化',
    options: [
      {
        id: 'serialization-json',
        name: 'kotlinx-serialization-json',
        version: '1.11.0',
        modules: [
          'org.jetbrains.kotlinx:kotlinx-serialization-core',
          'org.jetbrains.kotlinx:kotlinx-serialization-json',
        ],
        dependencies: ['kotlinx.serialization.core', 'kotlinx.serialization.json'],
        plugins: ['kotlinPluginSerialization'],
      },
      {
        id: 'serialization-hocon',
        name: 'kotlinx-serialization-hocon',
        version: '1.11.0',
        modules: [
          'org.jetbrains.kotlinx:kotlinx-serialization-core',
          'org.jetbrains.kotlinx:kotlinx-serialization-hocon',
        ],
        dependencies: ['kotlinx.serialization.core', 'kotlinx.serialization.hocon'],
        plugins: ['kotlinPluginSerialization'],
      },
      {
        id: 'serialization-properties',
        name: 'kotlinx-serialization-properties',
        version: '1.11.0',
        modules: [
          'org.jetbrains.kotlinx:kotlinx-serialization-core',
          'org.jetbrains.kotlinx:kotlinx-serialization-properties',
        ],
        dependencies: ['kotlinx.serialization.core', 'kotlinx.serialization.properties'],
        plugins: ['kotlinPluginSerialization'],
      },
      {
        id: 'serialization-toml',
        name: 'ktoml',
        version: '0.7.1',
        modules: ['com.akuleshov7:ktoml-core', 'com.akuleshov7:ktoml-file'],
        dependencies: ['kotlinx.serialization.core', 'ktoml.core', 'ktoml.file'],
        plugins: ['kotlinPluginSerialization'],
      },
      {
        id: 'serialization-yaml',
        name: 'kotaml (YAML)',
        version: '0.110.0',
        modules: ['io.heapy.kotaml:kotaml'],
        dependencies: ['kotlinx.serialization.core', 'kotaml'],
        plugins: ['kotlinPluginSerialization'],
      },
    ],
  },
  {
    id: 'di',
    name: '依赖注入',
    options: [
      {
        id: 'koin',
        name: 'Koin',
        version: '4.2.2',
        modules: ['io.insert-koin:koin-compose', 'io.insert-koin:koin-compose-viewmodel'],
        dependencies: [],
        catalogVersionKey: 'koin',
        catalogEntries: [
          { key: 'koin-compose', module: 'io.insert-koin:koin-compose' },
          { key: 'koin-compose-viewmodel', module: 'io.insert-koin:koin-compose-viewmodel' },
        ],
      },
      {
        id: 'koin-viewmodel-navigation',
        name: 'Koin ViewModel Navigation',
        version: '4.2.2',
        modules: ['io.insert-koin:koin-compose-viewmodel-navigation3'],
        dependencies: [],
        catalogVersionKey: 'koin',
        catalogEntries: [
          { key: 'koin-compose-viewmodel-navigation3', module: 'io.insert-koin:koin-compose-viewmodel-navigation3' },
        ],
        requires: ['koin', 'navigation3'],
      },
    ],
  },
  {
    id: 'file',
    name: '文件',
    options: [
      {
        id: 'filekit',
        name: 'FileKit',
        version: '0.16.0',
        modules: ['io.github.vinceglb:filekit-core'],
        dependencies: [],
        catalogVersionKey: 'filekit',
        catalogEntries: [{ key: 'filekit-core', module: 'io.github.vinceglb:filekit-core' }],
      },
      {
        id: 'filekit-dialogs',
        name: 'FileKit Dialogs',
        version: '0.16.0',
        modules: ['io.github.vinceglb:filekit-dialogs', 'io.github.vinceglb:filekit-dialogs-compose'],
        dependencies: [],
        catalogVersionKey: 'filekit',
        catalogEntries: [
          { key: 'filekit-dialogs', module: 'io.github.vinceglb:filekit-dialogs' },
          { key: 'filekit-dialogs-compose', module: 'io.github.vinceglb:filekit-dialogs-compose' },
        ],
        requires: ['filekit'],
      },
      {
        id: 'filekit-coil',
        name: 'FileKit Coil',
        version: '0.16.0',
        modules: ['io.github.vinceglb:filekit-coil'],
        dependencies: [],
        catalogVersionKey: 'filekit',
        catalogEntries: [{ key: 'filekit-coil', module: 'io.github.vinceglb:filekit-coil' }],
        requires: ['filekit', 'coil'],
      },
    ],
  },
  {
    id: 'i18n',
    name: '国际化',
    options: [
      {
        id: 'lyricist',
        name: 'lyricist',
        version: '1.9.0',
        modules: ['cafe.adriel.lyricist:lyricist'],
        dependencies: [],
        catalogVersionKey: 'lyricist',
        catalogEntries: [{ key: 'lyricist', module: 'cafe.adriel.lyricist:lyricist' }],
      },
      {
        id: 'lyricist-processor',
        name: 'lyricist-processor',
        version: '1.9.0',
        modules: ['ksp: cafe.adriel.lyricist:lyricist-processor'],
        dependencies: [],
        catalogVersionKey: 'lyricist',
        catalogEntries: [
          { key: 'lyricist-processor', module: 'cafe.adriel.lyricist:lyricist-processor', inject: 'ksp' },
        ],
        plugins: ['ksp'],
        requires: ['lyricist'],
      },
    ],
  },
  {
    id: 'util',
    name: '工具',
    options: [
      {
        id: 'kotlinx-datetime',
        name: 'kotlinx-datetime',
        version: '0.8.0',
        modules: ['org.jetbrains.kotlinx:kotlinx-datetime'],
        dependencies: [],
        catalogVersionKey: 'kotlinx-datetime',
        catalogEntries: [
          { key: 'kotlinx-datetime', module: 'org.jetbrains.kotlinx:kotlinx-datetime' },
        ],
      },
      {
        id: 'arrow',
        name: 'arrow',
        version: '2.2.3',
        modules: ['io.arrow-kt:arrow-core', 'io.arrow-kt:arrow-fx-coroutines'],
        dependencies: [],
        catalogVersionKey: 'arrow',
        catalogEntries: [
          { key: 'arrow-core', module: 'io.arrow-kt:arrow-core' },
          { key: 'arrow-fx-coroutines', module: 'io.arrow-kt:arrow-fx-coroutines' },
        ],
      },
      {
        id: 'multiplatform-settings',
        name: 'multiplatform-settings',
        version: '1.3.0',
        modules: ['com.russhwolf:multiplatform-settings'],
        dependencies: [],
        catalogVersionKey: 'multiplatform-settings',
        catalogEntries: [
          { key: 'multiplatform-settings', module: 'com.russhwolf:multiplatform-settings' },
        ],
      },
      {
        id: 'kotlinx-collections-immutable',
        name: 'kotlinx-collections-immutable',
        version: '0.5.2',
        modules: ['org.jetbrains.kotlinx:kotlinx-collections-immutable'],
        dependencies: [],
        catalogVersionKey: 'kotlinx-collections-immutable',
        catalogEntries: [
          { key: 'kotlinx-collections-immutable', module: 'org.jetbrains.kotlinx:kotlinx-collections-immutable' },
        ],
      },
      {
        id: 'picnic',
        name: 'picnic',
        version: '0.7.0',
        modules: ['com.jakewharton.picnic:picnic'],
        dependencies: [],
        catalogVersionKey: 'picnic',
        catalogEntries: [{ key: 'picnic', module: 'com.jakewharton.picnic:picnic' }],
      },
    ],
  },
  {
    id: 'io',
    name: 'IO',
    options: [
      {
        id: 'kotlinx-io',
        name: 'kotlinx-io',
        version: '0.9.1',
        modules: [
          'org.jetbrains.kotlinx:kotlinx-io-core',
          'org.jetbrains.kotlinx:kotlinx-io-bytestring',
        ],
        dependencies: ['kotlinx.io.core', 'kotlinx.io.bytestring'],
      },
    ],
  },
];

export const ALL_LIBRARIES: LibraryOption[] = LIBRARY_GROUPS.flatMap((g) => g.options);

export function findLibrary(id: string): LibraryOption | undefined {
  return ALL_LIBRARIES.find((l) => l.id === id);
}

/** Expands the selected library ids with their `requires` closure. */
export function resolveLibrarySelection(ids: string[]): LibraryOption[] {
  const resolved = new Map<string, LibraryOption>();
  const visit = (id: string) => {
    if (resolved.has(id)) return;
    const lib = findLibrary(id);
    if (!lib) return;
    resolved.set(id, lib);
    lib.requires?.forEach(visit);
  };
  ids.forEach(visit);
  return [...resolved.values()];
}
