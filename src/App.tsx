import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Command } from '@tauri-apps/plugin-shell';
import { FolderOpen, RefreshCw, Terminal as TerminalIcon, User, UserX, Search, Rocket, X, GitBranch, ChevronDown, Settings, AlertCircle } from 'lucide-react';
import logo from './assets/logo.png';
import { Worker } from './components/WorkerCard';
import FolderGroup from './components/FolderGroup';
import Terminal, { TerminalHandle } from './components/Terminal';
import MultiDeployModal, { WorkerDeployConfig } from './components/MultiDeployModal';
import DeploySettingsModal, { DEFAULT_DEPLOY_TEMPLATE } from './components/DeploySettingsModal';
import ErrorLogPanel, { AppError } from './components/ErrorLogPanel';


function App() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [basePath, setBasePath] = useState<string | null>(localStorage.getItem('last_path'));
  const [search, setSearch] = useState('');
  const [selectedShell, setSelectedShell] = useState(localStorage.getItem('selected_shell') || 'powershell');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [wranglerVersion, setWranglerVersion] = useState<string | null>(null);
  const [processRunning, setProcessRunning] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(280);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [multiDeployEnv, setMultiDeployEnv] = useState('default');
  const [showMultiDeployModal, setShowMultiDeployModal] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [deployTemplate, setDeployTemplate] = useState(() => {
    const saved = localStorage.getItem('deploy_template');
    // Migrate: old default included --config flag; reset to new default automatically.
    const OLD_DEFAULT = 'npx wrangler deploy --minify {env} --config={config}';
    if (!saved || saved === OLD_DEFAULT) return DEFAULT_DEPLOY_TEMPLATE;
    return saved;
  });
  const [deployDir, setDeployDir] = useState(localStorage.getItem('deploy_dir') ?? '');
  const [showDeploySettings, setShowDeploySettings] = useState(false);
  const [deployProgress, setDeployProgress] = useState<{ current: number; total: number } | null>(null);
  const [appErrors, setAppErrors] = useState<AppError[]>([]);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const errorIdRef = useRef(0);
  const authCheckActiveRef = useRef(false);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const terminalRef = useRef<TerminalHandle>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = terminalHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [terminalHeight]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartY.current - e.clientY; // drag up = bigger terminal
      const newHeight = Math.min(600, Math.max(120, dragStartHeight.current + delta));
      setTerminalHeight(newHeight);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const checkWranglerVersion = async () => {
    try {
      const program = navigator.userAgent.includes('Windows') ? 'npx.cmd' : 'npx';
      const command = Command.create(program, ['wrangler', '--version']);
      const output = await command.execute();
      if (output.code === 0) {
        // Output is typically "wrangler 3.x.x" or just "3.x.x"
        const match = output.stdout.trim().match(/(\d+\.\d+\.\d+)/);
        if (match) setWranglerVersion(match[1]);
      }
    } catch {
      setWranglerVersion(null);
    }
  };

  const pushError = useCallback((source: string, level: AppError['level'], message: string, detail?: string) => {
    setAppErrors(prev => {
      const idx = prev.findIndex(e => e.source === source && e.message === message);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], timestamp: new Date(), detail };
        return next;
      }
      return [...prev, { id: ++errorIdRef.current, timestamp: new Date(), source, level, message, detail }];
    });
  }, []);

  const checkLoginStatus = async () => {
    if (authCheckActiveRef.current) return;
    authCheckActiveRef.current = true;
    try {
      const command = Command.create('npx.cmd', ['wrangler', 'whoami']);
      const output = await command.execute();

      const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      const combined = stripAnsi(`${output.stdout}\n${output.stderr}`);

      const emailMatch = combined.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (emailMatch?.[1]) {
        setUserEmail(emailMatch[1].trim());
      } else {
        setUserEmail(null);
        const low = combined.toLowerCase();
        const isNotLogged = low.includes('not authenticated') || low.includes('you must run') || low.includes('not logged in');
        const isNetworkErr = low.includes('enotfound') || low.includes('fetch failed') || low.includes('network');
        if (isNetworkErr) {
          pushError('wrangler:auth', 'error', 'Error de red al verificar sesión de Wrangler.', combined.trim().slice(0, 200));
        } else if (isNotLogged || output.code !== 0) {
          pushError('wrangler:auth', 'warn', 'No hay sesión activa en Wrangler. Ejecutá "wrangler login" para autenticarte.', combined.trim().slice(0, 200));
        }
      }
    } catch (err) {
      setUserEmail(null);
      const msg = String(err);
      if (msg.includes('program not found') || msg.includes('No such file')) {
        pushError('wrangler:auth', 'error', 'npx/wrangler no encontrado. Verificá que Node.js y wrangler estén instalados.', msg);
      } else {
        pushError('wrangler:auth', 'error', 'Error inesperado al ejecutar wrangler whoami.', msg);
      }
    } finally {
      authCheckActiveRef.current = false;
    }
  };

  useEffect(() => {
    checkLoginStatus();
    checkWranglerVersion();
    const savedPath = localStorage.getItem('last_path');
    if (savedPath) {
      scanFolder(savedPath);
    }
  }, []);

  // Poll for login every 30s while disconnected
  useEffect(() => {
    if (userEmail) return; // already logged in, no polling needed

    const interval = setInterval(() => {
      checkLoginStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [userEmail]);

  const selectDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Seleccionar directorio de proyectos',
    });

    if (selected && typeof selected === 'string') {
      setBasePath(selected);
      localStorage.setItem('last_path', selected);
      scanFolder(selected);
    }
  };

  const scanFolder = async (path: string) => {
    setLoading(true);
    try {
      const results: Worker[] = await invoke('scan_workers', { basePath: path });
      setWorkers(results);
      terminalRef.current?.write(`\r\n\x1b[32mScan complete. Found ${results.length} workers.\x1b[0m\r\n`);
    } catch (err) {
      console.error(err);
      terminalRef.current?.write(`\r\n\x1b[31mError scanning: ${err}\x1b[0m\r\n`);
      pushError('scan_workers', 'error', `Error al escanear directorio: ${path}`, String(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Builds the deploy command for a worker.
   * When `indexPath` is provided, uses the explicit pattern:
   *   npx wrangler deploy --minify <index> [--env <env>] --config=<config>
   * Otherwise falls back to the user-configured template.
   */
  const buildDeployCommand = (worker: Worker, env?: string, indexPath?: string): string => {
    if (indexPath) {
      const envFlag = env ? ` --env ${env}` : '';
      return `npx wrangler deploy --minify ${indexPath}${envFlag} --config=${worker.path}`;
    }
    const envPart = env ? `--env ${env}` : '';
    return deployTemplate
      .replace('{config}', worker.path)
      .replace('{name}', worker.name)
      .replace('{env}', envPart)
      .trim()
      .replace(/\s{2,}/g, ' ');
  };

  /** Returns the directory containing the worker's config file. */
  const getWorkerDir = (worker: Worker): string => {
    // Works with both '/' and '\\' path separators
    const sep = worker.path.includes('\\') ? '\\' : '/';
    return worker.path.substring(0, worker.path.lastIndexOf(sep));
  };

  const resolveCwd = (worker: Worker): string => {
    const workerDir = getWorkerDir(worker);
    if (!deployDir) return workerDir;
    return deployDir.replace('{dir}', workerDir);
  };

  const handleDeploy = (worker: Worker, env?: string) => {
    terminalRef.current?.executeCommand(buildDeployCommand(worker, env), resolveCwd(worker));
  };

  const handleLogs = (worker: Worker, env?: string, format: string = 'pretty') => {
    const envFlag = env ? ` --env ${env}` : '';
    terminalRef.current?.executeCommand(
      `npx wrangler tail${envFlag} --format ${format}`,
      resolveCwd(worker)
    );
  };

  const handleShellChange = (shell: string) => {
    setSelectedShell(shell);
    localStorage.setItem('selected_shell', shell);
  };

  const handleLogin = () => {
    terminalRef.current?.executeCommand('npx wrangler login');
  };

  const handleOpenEditor = async (worker: Worker) => {
    try {
      await invoke('plugin:opener|open', { path: worker.path });
    } catch (err) {
      console.error('Failed to open editor:', err);
    }
  };

  // Environments shared by ALL selected workers; "default" is always included.
  const sharedEnvs = useMemo(() => {
    const selected = workers.filter(w => selectedWorkers.has(w.path));
    if (selected.length === 0) return ['default'];
    const named = selected.map(w => new Set(w.environments));
    const intersection = named.reduce((acc, set) => new Set([...acc].filter(e => set.has(e))));
    return ['default', ...Array.from(intersection).sort()];
  }, [workers, selectedWorkers]);

  // Reset env selection if it's no longer in the shared list.
  useEffect(() => {
    if (!sharedEnvs.includes(multiDeployEnv)) setMultiDeployEnv('default');
  }, [sharedEnvs, multiDeployEnv]);

  const toggleWorkerSelection = useCallback((worker: Worker) => {
    setSelectedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(worker.path)) next.delete(worker.path);
      else next.add(worker.path);
      return next;
    });
  }, []);

  const handleMultiDeploy = async (configs: WorkerDeployConfig[]) => {
    const env = multiDeployEnv !== 'default' ? multiDeployEnv : undefined;
    const commands = configs.map(({ worker, indexPath }) => ({
      command: buildDeployCommand(worker, env, indexPath || undefined),
      cwd: resolveCwd(worker),
      label: worker.name,
    }));
    setShowMultiDeployModal(false);
    setDeployProgress({ current: 0, total: commands.length });
    await terminalRef.current?.executeSequential(commands, (done, total) => {
      setDeployProgress({ current: done, total });
    });
    setDeployProgress(null);
  };

  const fetchBranchInfo = useCallback(async (path: string) => {
    try {
      const headCmd = Command.create('git', ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD']);
      const headOut = await headCmd.execute();
      if (headOut.code === 0) {
        setCurrentBranch(headOut.stdout.trim());
      } else {
        setCurrentBranch(null);
        setBranches([]);
        return;
      }
      const listCmd = Command.create('git', ['-C', path, 'branch']);
      const listOut = await listCmd.execute();
      if (listOut.code === 0) {
        const parsed = listOut.stdout
          .split('\n')
          .map(b => b.replace(/^\*?\s+/, '').trim())
          .filter(Boolean);
        setBranches(parsed);
      }
    } catch {
      setCurrentBranch(null);
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    if (basePath) fetchBranchInfo(basePath);
    else { setCurrentBranch(null); setBranches([]); }
  }, [basePath, fetchBranchInfo]);

  const handleBranchSwitch = async (branch: string) => {
    if (!basePath || branch === currentBranch) return;
    setBranchMenuOpen(false);
    await terminalRef.current?.executeCommand(`git checkout ${branch}`, basePath);
    fetchBranchInfo(basePath);
    scanFolder(basePath);
  };

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.environments.some(env => env.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 p-4">
      {/* Header */}
      <header className="glass flex items-center justify-between px-8 py-3 z-10">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Worker Manager logo"
            className="w-24 h-24 rounded-full object-cover shrink-0 shadow-lg shadow-sky-500/10"
          />
          <div className="flex flex-col">
            <h1 className="text-2xl font-black bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent leading-none">
              Open Worker Manager
            </h1>
            {/* Row 1: badges */}
            <div className="flex items-center gap-2 mt-1">
              {userEmail ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400">
                  <User size={10} /> {userEmail}
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <UserX size={10} /> Disconnected
                </button>
              )}
              {wranglerVersion && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400">
                  wrangler v{wranglerVersion}
                </span>
              )}
            </div>
            {/* Row 2: current path + branch */}
            {basePath && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-slate-600 font-mono truncate max-w-[240px]" title={basePath}>
                  📁 {basePath}
                </p>
                {currentBranch && (
                  <div className="relative">
                    <button
                      onClick={() => setBranchMenuOpen(o => !o)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <GitBranch size={9} />
                      {currentBranch}
                      {branches.length > 1 && <ChevronDown size={9} className={`transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />}
                    </button>
                    {branchMenuOpen && branches.length > 1 && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setBranchMenuOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-30 min-w-[160px] py-1 overflow-hidden">
                          {branches.map(branch => (
                            <button
                              key={branch}
                              onClick={() => handleBranchSwitch(branch)}
                              className={`w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors flex items-center gap-1.5 ${branch === currentBranch
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                              {branch === currentBranch && <span className="text-emerald-400">✓</span>}
                              {branch}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>{/* end flex-col */}
        </div>{/* end flex items-center gap-3 */}

        {/* Search */}
        <div className="flex-1 max-w-md mx-8 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search workers, envs, paths..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-sky-500/50 focus:bg-slate-900 transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Error log button */}
          <button
            onClick={() => setShowErrorLog(v => !v)}
            className={`relative p-2 rounded-lg transition-colors ${showErrorLog ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400'}`}
            title="Error log"
          >
            <AlertCircle size={18} />
            {appErrors.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                {appErrors.length > 99 ? '99+' : appErrors.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowDeploySettings(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-400 transition-colors"
            title="Configurar comando de deploy"
          >
            <Settings size={18} />
          </button>
          {basePath && (
            <button
              onClick={() => scanFolder(basePath)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            onClick={selectDirectory}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-sky-500/20"
          >
            <FolderOpen size={18} />
            Abrir directorio
          </button>
        </div>
      </header>

      {/* Multi-deploy bar */}
      {selectedWorkers.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 shrink-0">
          <span className="text-xs font-bold text-indigo-300">
            {selectedWorkers.size} worker{selectedWorkers.size > 1 ? 's' : ''} seleccionado{selectedWorkers.size > 1 ? 's' : ''}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-400/60">Entorno:</span>
            <select
              value={multiDeployEnv}
              onChange={e => setMultiDeployEnv(e.target.value)}
              className="bg-slate-900 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded px-2 py-1 outline-none hover:border-indigo-400 transition-colors cursor-pointer"
            >
              {sharedEnvs.map(env => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setSelectedWorkers(new Set())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 transition-all"
          >
            <X size={11} />
            Deseleccionar todo
          </button>
          <button
            onClick={() => setShowMultiDeployModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Rocket size={12} />
            Deploy {selectedWorkers.size} workers
          </button>
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {filteredWorkers.length > 0 ? (
          <FolderGroup
            workers={filteredWorkers}
            onDeploy={handleDeploy}
            onLogs={handleLogs}
            onOpen={handleOpenEditor}
            selectedWorkers={selectedWorkers}
            onSelectToggle={toggleWorkerSelection}
          />
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-600">
            <TerminalIcon size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-medium">
              {workers.length > 0 ? 'No results found' : 'Ready to scan projects'}
            </p>
            <p className="text-sm opacity-60 mt-1">
              {workers.length > 0 ? 'Try searching for something else' : 'Select a directory to list your workers'}
            </p>
          </div>
        )}
      </main>

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="group relative h-2 w-full cursor-ns-resize bg-transparent hover:bg-sky-500/10 transition-colors flex items-center justify-center shrink-0"
        title="Drag to resize terminal"
      >
        <div className="w-12 h-0.5 rounded-full bg-slate-700 group-hover:bg-sky-500 transition-colors" />
      </div>

      {/* Multi-deploy progress bar */}
      {deployProgress && (
        <div className="shrink-0 px-4 py-2 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1.5">
              <Rocket size={10} />
              Deploying {deployProgress.current} / {deployProgress.total} workers
            </span>
            <span className="text-[10px] font-bold text-indigo-400">
              {Math.round((deployProgress.current / deployProgress.total) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full transition-all duration-500"
              style={{ width: `${(deployProgress.current / deployProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Terminal Area */}
      <div className="relative w-full shrink-0" style={{ height: terminalHeight }}>
        {processRunning && (
          <button
            onClick={() => terminalRef.current?.kill()}
            className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-[11px] font-bold transition-all shadow-lg"
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-current" />
            Stop
          </button>
        )}
        <Terminal
          ref={terminalRef}
          selectedShell={selectedShell}
          onShellChange={handleShellChange}
          onProcessChange={setProcessRunning}
          height={terminalHeight}
        />
      </div>

      {/* Multi-deploy confirmation modal */}
      {showMultiDeployModal && (
        <MultiDeployModal
          workers={workers.filter(w => selectedWorkers.has(w.path))}
          selectedEnv={multiDeployEnv}
          onConfirm={handleMultiDeploy}
          onCancel={() => setShowMultiDeployModal(false)}
        />
      )}

      {/* Error log panel */}
      {showErrorLog && (
        <ErrorLogPanel
          errors={appErrors}
          onClear={() => setAppErrors([])}
          onClose={() => setShowErrorLog(false)}
        />
      )}

      {/* Deploy command settings modal */}
      {showDeploySettings && (
        <DeploySettingsModal
          template={deployTemplate}
          deployDir={deployDir}
          onSave={(t, d) => {
            setDeployTemplate(t);
            setDeployDir(d);
            localStorage.setItem('deploy_template', t);
            localStorage.setItem('deploy_dir', d);
            setShowDeploySettings(false);
          }}
          onCancel={() => setShowDeploySettings(false)}
        />
      )}
    </div>
  );
}

export default App;
