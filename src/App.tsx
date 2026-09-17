import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LIBRARY_GROUPS, PLATFORMS, findLibrary, type LibraryOption } from './lib/config';
import { loadTemplate } from './lib/template';
import { transformTemplate } from './lib/transform';
import { buildZip, downloadZip } from './lib/zip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PendingInstall {
  libId: string;
  name: string;
  /** Human-readable missing dependency descriptions for the dialog text. */
  parts: string[];
  /** Library ids to select together on confirm. */
  installIds: string[];
}

const PROJECT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const PACKAGE_NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function sanitizePackageSegment(name: string): string {
  const segment = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return /^[a-z]/.test(segment) ? segment : 'app';
}

export default function App() {
  const [projectName, setProjectName] = useState('my-compose-app');
  const [packageName, setPackageName] = useState('com.example.mycomposeapp');
  const [packageTouched, setPackageTouched] = useState(false);
  const [resourcesPackage, setResourcesPackage] = useState('com.example.mycomposeapp.generated.resources');
  const [resourcesTouched, setResourcesTouched] = useState(false);
  const [windowTitle, setWindowTitle] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['macosArm64']);
  const [libraries, setLibraries] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [pendingInstall, setPendingInstall] = useState<PendingInstall | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const projectNameValid = PROJECT_NAME_RE.test(projectName);
  const packageNameValid = PACKAGE_NAME_RE.test(packageName);
  const resourcesPackageValid = PACKAGE_NAME_RE.test(resourcesPackage);
  const platformsValid = platforms.length > 0;
  const formValid = projectNameValid && packageNameValid && resourcesPackageValid && platformsValid && !generating;

  function onProjectNameChange(value: string) {
    setProjectName(value);
    if (!packageTouched) {
      const nextPackage = `com.example.${sanitizePackageSegment(value)}`;
      setPackageName(nextPackage);
      if (!resourcesTouched) {
        setResourcesPackage(`${nextPackage}.generated.resources`);
      }
    }
  }

  function togglePlatform(id: string) {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  /** Missing dependencies of a library against the current selection. */
  function missingDeps(lib: LibraryOption): { missing: string[]; anyMissing: boolean } {
    const missing = (lib.requires ?? []).filter((r) => !libraries.includes(r));
    const anyGroup = lib.requiresAny ?? [];
    const anyMissing = anyGroup.length > 0 && !anyGroup.some((r) => libraries.includes(r));
    return { missing, anyMissing };
  }

  function toggleLibrary(id: string) {
    if (libraries.includes(id)) {
      setLibraries((prev) => prev.filter((l) => l !== id));
      return;
    }
    const lib = findLibrary(id);
    if (!lib) return;
    const { missing, anyMissing } = missingDeps(lib);
    if (missing.length > 0 || anyMissing) {
      const parts = missing.map((r) => findLibrary(r)?.name ?? r);
      const installIds = [...missing];
      if (anyMissing) {
        const fallbackId = lib.requiresAny![0];
        parts.push(`${lib.requiresAnyLabel ?? lib.requiresAny!.join(' / ')}（将安装 ${findLibrary(fallbackId)?.name ?? fallbackId}）`);
        installIds.push(fallbackId);
      }
      setPendingInstall({ libId: id, name: lib.name, parts, installIds });
      return;
    }
    setLibraries((prev) => [...prev, id]);
  }

  function confirmInstall() {
    if (!pendingInstall) return;
    setLibraries((prev) => [...prev, pendingInstall.libId, ...pendingInstall.installIds]);
    setPendingInstall(null);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setDone(null);
    try {
      const template = await loadTemplate();
      const files = transformTemplate(template.files, {
        projectName,
        packageName,
        resourcesPackage,
        windowTitle: windowTitle.trim() || projectName,
        platforms,
        libraries,
      });
      const zip = buildZip(files, projectName, template.executables);
      downloadZip(zip, `${projectName}.zip`);
      setDone(`${projectName}.zip（${(zip.byteLength / 1024).toFixed(0)} KB，${files.size} 个文件）`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="page">
      <header>
        <h1>Compose Multiplatform Native Wizard</h1>
      </header>

      <div className="layout">
        <div className="column">
          <section>
            <h2>基本信息</h2>
            <div className="field">
              <label htmlFor="projectName">项目名</label>
              <input
                id="projectName"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                placeholder="my-compose-app"
              />
              {!projectNameValid && <span className="hint error">字母开头，只能包含字母、数字、-、_</span>}
            </div>
            <div className="field">
              <label htmlFor="packageName">包名</label>
              <input
                id="packageName"
                value={packageName}
                onChange={(e) => {
                  setPackageName(e.target.value);
                  setPackageTouched(true);
                  if (!resourcesTouched) {
                    setResourcesPackage(`${e.target.value}.generated.resources`);
                  }
                }}
                placeholder="com.example.app"
              />
              {!packageNameValid && <span className="hint error">至少两段小写标识符，如 com.example.app</span>}
            </div>
            <div className="field">
              <label htmlFor="resourcesPackage">资源生成位置</label>
              <input
                id="resourcesPackage"
                value={resourcesPackage}
                onChange={(e) => {
                  setResourcesPackage(e.target.value);
                  setResourcesTouched(true);
                }}
                placeholder={`${packageName}.generated.resources`}
              />
              {!resourcesPackageValid && (
                <span className="hint error">需要合法的包名，如 com.example.app.generated.resources</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="windowTitle">窗口标题</label>
              <input
                id="windowTitle"
                value={windowTitle}
                onChange={(e) => setWindowTitle(e.target.value)}
                placeholder={projectName}
              />
              <span className="hint">留空则使用项目名</span>
            </div>
          </section>

          <section>
            <h2>
              目标平台 <span className="hint">（至少选择一个）</span>
            </h2>
            <div className="options">
              {PLATFORMS.map((p) => (
                <label key={p.id} className={`option ${platforms.includes(p.id) ? 'checked' : ''}`}>
                  <input type="checkbox" checked={platforms.includes(p.id)} onChange={() => togglePlatform(p.id)} />
                  <span className="option-name">{p.name}</span>
                </label>
              ))}
            </div>
            {!platformsValid && <span className="hint error">请至少选择一个目标平台</span>}
          </section>

          <div className="actions">
            <button disabled={!formValid} onClick={generate}>
              {generating ? '正在生成…' : '创建'}
            </button>
            {done && <span className="hint success">已下载 {done}</span>}
            {error && <span className="hint error">{error}</span>}
          </div>
        </div>

        <div className="column">
          <section>
            <h2>预装库</h2>
            {LIBRARY_GROUPS.map((group) => {
              const isCollapsed = collapsedGroups.includes(group.id);
              return (
                <div key={group.id} className="library-group">
                  <button
                    type="button"
                    className="group-header"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!isCollapsed}
                  >
                    <motion.span
                      className="group-chevron"
                      animate={{ rotate: isCollapsed ? -90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      ▾
                    </motion.span>
                    {group.name}
                  </button>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="content"
                        className="group-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className="options">
                          {group.options.map((lib) => {
                            const checked = libraries.includes(lib.id);
                            const { missing, anyMissing } = missingDeps(lib);
                            const blocked = !checked && (missing.length > 0 || anyMissing);
                            return (
                              <label
                                key={lib.id}
                                className={`option ${checked ? 'checked' : ''} ${blocked ? 'disabled' : ''}`}
                                onClick={
                                  blocked
                                    ? (e) => {
                                        e.preventDefault();
                                        toggleLibrary(lib.id);
                                      }
                                    : undefined
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={blocked}
                                  onChange={() => toggleLibrary(lib.id)}
                                />
                                <span className="option-name">
                                  <span>{lib.name}</span>
                                  <code className="option-version">{lib.version}</code>
                                </span>
                                <span className="option-modules">
                                  {lib.modules.map((m) => (
                                    <code key={m}>{m}</code>
                                  ))}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <Dialog open={pendingInstall !== null} onOpenChange={(open) => !open && setPendingInstall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>需要安装依赖</DialogTitle>
            <DialogDescription>
              {pendingInstall && `${pendingInstall.name} 依赖 ${pendingInstall.parts.join('、')}，是否安装？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingInstall(null)}>
              取消
            </Button>
            <Button onClick={confirmInstall}>安装</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
