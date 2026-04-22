import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Command } from '@tauri-apps/plugin-shell';
import { FolderOpen, RefreshCw, Terminal as TerminalIcon, User, UserX, Search } from 'lucide-react';
import { Worker } from './components/WorkerCard';
import FolderGroup from './components/FolderGroup';
import Terminal, { TerminalHandle } from './components/Terminal';

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

  const [debugStatus, setDebugStatus] = useState<string>('checking...');

  const checkLoginStatus = async () => {
    try {
      const program = 'npx.cmd';
      setDebugStatus(`calling ${program} wrangler whoami...`);
      const command = Command.create(program, ['wrangler', 'whoami']);
      const output = await command.execute();

      const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      const combined = stripAnsi(`${output.stdout}\n${output.stderr}`);

      setDebugStatus(`code=${output.code} | out="${output.stdout.slice(0, 40)}" | err="${output.stderr.slice(0, 80)}"`);

      const emailMatch = combined.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (emailMatch?.[1]) {
        setUserEmail(emailMatch[1].trim());
        setDebugStatus('');
      } else {
        setUserEmail(null);
      }
    } catch (err) {
      setDebugStatus(`ERROR: ${String(err)}`);
      setUserEmail(null);
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
    }, 30000);

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
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = (worker: Worker, env?: string) => {
    const directory = worker.path.substring(0, worker.path.lastIndexOf('\\'));
    const envFlag = env ? ` --env ${env}` : '';
    terminalRef.current?.executeCommand(`npx wrangler deploy --name ${worker.name}${envFlag}`, directory);
  };

  const handleLogs = (worker: Worker, env?: string, format: string = 'pretty') => {
    const directory = worker.path.substring(0, worker.path.lastIndexOf('\\'));
    const envFlag = env ? ` --env ${env}` : '';
    terminalRef.current?.executeCommand(`npx wrangler tail --config=${worker.path}${envFlag} --format ${format}`, directory);
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

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.environments.some(env => env.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 p-4">
      {/* Header */}
      <header className="glass flex items-center justify-between px-8 py-3 z-10">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent leading-none">
            WRANGLER MANAGER
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
            {debugStatus && (
              <span className="text-[10px] text-yellow-400 font-mono max-w-[400px] truncate" title={debugStatus}>
                🐛 {debugStatus}
              </span>
            )}
          </div>
          {/* Row 2: current path */}
          {basePath && (
            <p className="text-[10px] text-slate-600 font-mono mt-1 truncate max-w-[340px]" title={basePath}>
              📁 {basePath}
            </p>
          )}
        </div>

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
            Open Folder
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {filteredWorkers.length > 0 ? (
          <FolderGroup
            workers={filteredWorkers}
            onDeploy={handleDeploy}
            onLogs={handleLogs}
            onOpen={handleOpenEditor}
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
    </div>
  );
}

export default App;
