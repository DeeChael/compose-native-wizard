// Node-side smoke test for the transformation pipeline.
// Bundles src/lib/transform.ts with esbuild, feeds it the real template
// directory, and asserts the generated output for several option combos.
//
// Usage: node scripts/validate.mjs   (requires npm install first)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const templateDir = resolve(root, '..', '..', 'kotlin', 'compose-native-template');
const bundlePath = join(root, 'node_modules', '.tmp', 'transform.bundle.mjs');

execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  ['src/lib/transform.ts', '--bundle', '--format=esm', '--platform=neutral', `--outfile=${bundlePath}`],
  { cwd: root, stdio: 'inherit' },
);
const { transformTemplate } = await import(pathToFileURL(bundlePath).href);

const EXCLUDED_DIRS = new Set(['.git', '.gradle', '.idea', 'build', '.kotlin']);
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const template = new Map();
for (const full of walk(templateDir)) {
  template.set(relative(templateDir, full).split('\\').join('/'), new Uint8Array(readFileSync(full)));
}

const dec = new TextDecoder();
let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    console.error(`FAIL  ${label}`);
    failures++;
  }
}

// ── Case 1: all platforms, all libraries, renamed ──────────────────────────
console.log('Case 1: all platforms + all libraries + rename');
{
  const files = transformTemplate(template, {
    projectName: 'demo-app',
    packageName: 'io.acme.demo',
    windowTitle: 'Demo App',
    platforms: ['linuxX64', 'linuxArm64', 'macosArm64', 'mingwX64'],
    libraries: [
      'material-icons', 'haze-blur', 'haze-glass', 'coil',
      'voyager-navigator', 'voyager-screenmodel', 'voyager-bottom-sheet-navigator',
      'voyager-tab-navigator', 'voyager-transitions', 'ktorfit',
      'serialization-json', 'serialization-hocon', 'serialization-properties',
      'serialization-toml', 'serialization-yaml', 'kotlinx-io',
      'kotlinx-datetime', 'navigation3', 'arrow', 'multiplatform-settings',
      'koin', 'koin-viewmodel-navigation', 'filekit', 'filekit-dialogs', 'filekit-coil', 'voyager-koin',
      'kotlinx-collections-immutable', 'picnic', 'lyricist', 'lyricist-processor',
    ],
  });

  const appKts = dec.decode(files.get('composeApp/build.gradle.kts'));
  check('4 个 target 都在', ['linuxX64', 'linuxArm64', 'macosArm64', 'mingwX64'].every((t) =>
    appKts.includes(`add(${t}())`)));
  check('mingw/linux linkerOpts 分支都在', appKts.includes('target.name == "mingwX64"') &&
    appKts.includes('target.name.startsWith("linux")'));
  check('ktorfit 自动带上 ktor', appKts.includes('implementation(libs.ktor.client.cio)'));
  check('voyager 五个模块分开注入', ['navigator', 'screenModel', 'bottomSheetNavigator', 'tabNavigator', 'transitions']
    .every((m) => appKts.includes(`implementation(libs.voyager.${m})`)));
  check('haze blur/glass 依赖注入', appKts.includes('implementation(libs.haze.blur.material3)') &&
    appKts.includes('implementation(libs.haze.glass.material3)'));
  check('haze 核心依赖去重（libs.haze) 只出现一次）',
    appKts.split('implementation(libs.haze)').length === 2);
  check('新库以 catalog 访问器注入',
    [
      'implementation(libs.navigation3.runtime)',
      'implementation(libs.navigation3.ui)',
      'implementation(libs.voyager.koin)',
      'implementation(libs.koin.compose)',
      'implementation(libs.koin.compose.viewmodel)',
      'implementation(libs.koin.compose.viewmodel.navigation3)',
      'implementation(libs.filekit.core)',
      'implementation(libs.filekit.dialogs)',
      'implementation(libs.filekit.dialogs.compose)',
      'implementation(libs.filekit.coil)',
      'implementation(libs.lyricist)',
      'ksp(libs.lyricist.processor)',
      'implementation(libs.kotlinx.datetime)',
      'implementation(libs.arrow.core)',
      'implementation(libs.arrow.fx.coroutines)',
      'implementation(libs.multiplatform.settings)',
      'implementation(libs.kotlinx.collections.immutable)',
      'implementation(libs.picnic)',
    ].every((d) => appKts.includes(d)));
  check('无原始坐标注入', !appKts.includes('implementation("'));
  check('lyricist-processor 带 ksp 插件', appKts.includes('alias(libs.plugins.ksp)'));

  const toml = dec.decode(files.get('gradle/libs.versions.toml'));
  check('catalog 新增 [versions] 条目',
    ['koin = "4.2.2"', 'filekit = "0.16.0"', 'lyricist = "1.9.0"', 'navigation3 = "1.1.0-alpha02"',
      'kotlinx-datetime = "0.8.0"', 'arrow = "2.2.3"', 'multiplatform-settings = "1.3.0"',
      'kotlinx-collections-immutable = "0.5.2"', 'picnic = "0.7.0"'].every((v) => toml.includes(v)));
  check('catalog 新增 [libraries] 条目',
    [
      'voyager-koin = { module = "cafe.adriel.voyager:voyager-koin", version.ref = "voyager" }',
      'koin-compose = { module = "io.insert-koin:koin-compose", version.ref = "koin" }',
      'koin-compose-viewmodel-navigation3 = { module = "io.insert-koin:koin-compose-viewmodel-navigation3", version.ref = "koin" }',
      'filekit-core = { module = "io.github.vinceglb:filekit-core", version.ref = "filekit" }',
      'lyricist-processor = { module = "cafe.adriel.lyricist:lyricist-processor", version.ref = "lyricist" }',
      'picnic = { module = "com.jakewharton.picnic:picnic", version.ref = "picnic" }',
    ].every((l) => toml.includes(l)));
  check('已有版本 key 不重复添加（voyager 只出现一次）', toml.split('voyager = "').length === 2);
  check('共享版本 key 去重（koin/filekit/lyricist 各一次）',
    toml.split('koin = "').length === 2 && toml.split('filekit = "').length === 2 &&
    toml.split('lyricist = "').length === 2);
  check('无注释残留', !toml.includes('#'));
  check('孤儿版本 key knbt 已清除', !toml.includes('knbt'));
  check('构建脚本无 sdl 依赖', !appKts.includes('implementation(libs.compose.sdl)'));
  check('catalog 无 sdl 条目', !toml.includes('sdl'));
  check('依赖去重（serialization.core 只出现一次）',
    appKts.split('implementation(libs.kotlinx.serialization.core)').length === 2);
  check('ksp/ktorfit/serialization 插件已应用',
    ['ksp', 'ktorfit', 'kotlinPluginSerialization'].every((p) => appKts.includes(`alias(libs.plugins.${p})`)));

  const rootKts = dec.decode(files.get('build.gradle.kts'));
  check('根插件 apply false', ['ksp', 'ktorfit', 'kotlinPluginSerialization'].every((p) =>
    rootKts.includes(`alias(libs.plugins.${p}) apply false`)));

  const settings = dec.decode(files.get('settings.gradle.kts'));
  check('rootProject.name 已写入', settings.includes('rootProject.name = "demo-app"'));

  const gradleProps = dec.decode(files.get('gradle.properties'));
  check('macOS experimental 行保留', gradleProps.includes('org.jetbrains.compose.experimental.macos.enabled=true'));

  const readme = dec.decode(files.get('README.md'));
  check('README 标题替换', readme.startsWith('# demo-app'));

  const entry = dec.decode(files.get('composeApp/src/nativeMain/kotlin/io/acme/demo/Entrypoint.kt'));
  check('窗口标题替换', entry.includes('title = "Demo App"'));
  check('包名路径迁移（Entrypoint）', files.has('composeApp/src/nativeMain/kotlin/io/acme/demo/Entrypoint.kt'));
  check('包名路径迁移（Platform.mingwX64）',
    files.has('composeApp/src/mingwX64Main/kotlin/io/acme/demo/Platform.mingwX64.kt'));

  let residualCount = 0;
  for (const [path, data] of files) {
    if ((path.endsWith('.kt') || path.endsWith('.kts')) && dec.decode(data).includes('com.example.cmpn')) {
      console.error(`     com.example.cmpn 残留: ${path}`);
      residualCount++;
    }
    if (path.includes('com/example/cmpn')) {
      console.error(`     目录残留: ${path}`);
      residualCount++;
    }
  }
  check('无 com.example.cmpn 残留', residualCount === 0);
  check('entryPoint 包名替换', appKts.includes('entryPoint = "io.acme.demo.main"'));
  check('packageOfResClass 包名替换', appKts.includes('packageOfResClass = "io.acme.demo.generated.resources"'));
}

// ── Case 2: macOS only, no libraries ───────────────────────────────────────
console.log('Case 2: macOS only + no libraries');
{
  const files = transformTemplate(template, {
    projectName: 'mac-only',
    packageName: 'com.example.cmpn',
    windowTitle: 'mac-only',
    platforms: ['macosArm64'],
    libraries: [],
  });

  const appKts = dec.decode(files.get('composeApp/build.gradle.kts'));
  check('只剩 macosArm64 target', appKts.includes('add(macosArm64())') &&
    !appKts.includes('add(linuxX64())') && !appKts.includes('add(mingwX64())'));
  check('无 linkerOpts when 分支', !appKts.includes('when {') && !appKts.includes('linkerOpts'));
  check('未选平台 source set 已删除',
    !['linuxX64', 'linuxArm64', 'mingwX64'].some((t) =>
      [...files.keys()].some((p) => p.startsWith(`composeApp/src/${t}Main/`))));
  check('macosArm64 source set 保留',
    files.has('composeApp/src/macosArm64Main/kotlin/com/example/cmpn/Platform.macosArm64.kt'));
  const gradleProps = dec.decode(files.get('gradle.properties'));
  check('macOS experimental 行保留', gradleProps.includes('org.jetbrains.compose.experimental.macos.enabled=true'));
  check('无额外依赖注入', !appKts.includes('implementation(libs.voyager'));
  check('无额外插件', !appKts.includes('libs.plugins.ksp'));

  const toml = dec.decode(files.get('gradle/libs.versions.toml'));
  check('未选库的 catalog 条目已清除',
    !['voyager', 'haze', 'coil', 'ktoml', 'kotaml', 'knbt', 'material-icons', 'ktor-client', 'ktorfit',
      'kotlinx-serialization', 'kotlinx-io'].some((k) => toml.includes(k)));
  check('未选库的插件已清除', !toml.includes('ksp') && !toml.includes('kotlinPluginSerialization'));
  check('catalog 无注释残留', !toml.includes('#'));
  check('核心 catalog 条目保留',
    ['kotlin-test', 'compose-desktopNativeWindow', 'composeDesktopNativeBridge',
      'kotlin = "', 'composeMultiplatform = "'].every((k) => toml.includes(k)));
  check('sdl 依赖与条目已移除', !appKts.includes('implementation(libs.compose.sdl)') && !toml.includes('sdl'));
}

// ── Case 3: Windows + Linux x64, ktorfit only ──────────────────────────────
console.log('Case 3: mingwX64 + linuxX64 + ktorfit');
{
  const files = transformTemplate(template, {
    projectName: 'win-linux',
    packageName: 'org.example.wl',
    windowTitle: 'WinLinux',
    platforms: ['mingwX64', 'linuxX64'],
    libraries: ['ktorfit'],
  });

  const appKts = dec.decode(files.get('composeApp/build.gradle.kts'));
  check('target 正确', appKts.includes('add(mingwX64())') && appKts.includes('add(linuxX64())') &&
    !appKts.includes('add(macosArm64())'));
  check('两个 linkerOpts 分支都在', appKts.includes('target.name == "mingwX64"') &&
    appKts.includes('target.name.startsWith("linux")'));
  check('macOS experimental 行已移除',
    !dec.decode(files.get('gradle.properties')).includes('experimental.macos'));
  check('macosArm64 source set 已删除',
    ![...files.keys()].some((p) => p.startsWith('composeApp/src/macosArm64Main/')));
  check('ktor 依赖自动注入', appKts.includes('implementation(libs.ktor.client.core)'));
  check('ktorfit 不手动添加 ksp 依赖（由 ktorfit 插件处理）', !appKts.includes('ksp(libs'));

  const toml = dec.decode(files.get('gradle/libs.versions.toml'));
  check('选中的库条目保留（ktor/ktorfit/ksp）',
    ['ktor = "', 'ktor-client-core', 'ktorfit = "', 'ksp = "', 'id = "com.google.devtools.ksp"',
      'id = "de.jensklingenberg.ktorfit"'].every((k) => toml.includes(k)));
  check('未选库条目已清除', !['voyager', 'haze', 'coil', 'knbt'].some((k) => toml.includes(k)));
}

// ── Case 5: lyricist only, no KSP ───────────────────────────────────────────
console.log('Case 5: 仅 lyricist 本体');
{
  const files = transformTemplate(template, {
    projectName: 'lyr', packageName: 'a.b', windowTitle: 'lyr',
    platforms: ['macosArm64'], libraries: ['lyricist'],
  });
  const appKts = dec.decode(files.get('composeApp/build.gradle.kts'));
  check('lyricist 本体注入', appKts.includes('implementation(libs.lyricist)'));
  check('不应用 ksp 插件', !appKts.includes('alias(libs.plugins.ksp)'));
  check('无手动 ksp 依赖', !appKts.includes('ksp(libs'));
}

// ── Case 6: empty platform selection must throw ─────────────────────────────
console.log('Case 6: 不选平台应抛错');
{
  let threw = false;
  try {
    transformTemplate(template, {
      projectName: 'x', packageName: 'a.b', windowTitle: 'x', platforms: [], libraries: [],
    });
  } catch {
    threw = true;
  }
  check('抛出异常', threw);
}

// ── Case 7: custom resources package ────────────────────────────────────────
console.log('Case 7: 自定义资源生成位置');
{
  const files = transformTemplate(template, {
    projectName: 'res-demo', packageName: 'io.acme.demo', windowTitle: 'res-demo',
    resourcesPackage: 'io.acme.custom.res',
    platforms: ['macosArm64'], libraries: [],
  });
  const appKts = dec.decode(files.get('composeApp/build.gradle.kts'));
  const appKt = dec.decode(files.get('composeApp/src/commonMain/kotlin/io/acme/demo/App.kt'));
  check('packageOfResClass 替换为自定义值', appKts.includes('packageOfResClass = "io.acme.custom.res"'));
  check('App.kt Res import 替换为自定义值', appKt.includes('import io.acme.custom.res'));
  check('无默认资源包名残留', !appKts.includes('io.acme.demo.generated.resources') &&
    !appKt.includes('io.acme.demo.generated.resources'));
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
