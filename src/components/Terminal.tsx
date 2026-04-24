import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { Command } from '@tauri-apps/plugin-shell';
import { Trash2, Search, ChevronUp, ChevronDown, X, FolderSearch } from 'lucide-react';

export interface TerminalHandle {
  executeCommand: (commandStr: string, cwd?: string) => Promise<void>;
  executeSequential: (commands: { command: string; cwd?: string; label?: string }[]) => Promise<void>;
  write: (text: string) => void;
  kill: () => Promise<void>;
}

interface TerminalProps {
  selectedShell: string;
  onShellChange: (shell: string) => void;
  onProcessChange?: (running: boolean) => void;
  height: number;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ selectedShell, onShellChange, onProcessChange, height }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const activeChildRef = useRef<Awaited<ReturnType<ReturnType<typeof Command.create>['spawn']>> | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const handleSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    if (!searchAddonRef.current || !query) return;
    const options = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      incremental: false,
      decorations: {
        matchBackground: '#374151',
        matchBorder: '#38bdf8',
        matchOverviewRuler: '#38bdf8',
        activeMatchBackground: '#38bdf8',
        activeMatchBorder: '#ffffff',
        activeMatchColorOverviewRuler: '#38bdf8',
      },
    };
    if (direction === 'next') {
      searchAddonRef.current.findNext(query, options);
    } else {
      searchAddonRef.current.findPrevious(query, options);
    }
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen(prev => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSearchQuery('');
        setSearchResultCount(null);
      }
      return !prev;
    });
  }, []);

  // Keyboard shortcut: Ctrl+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearch();
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, toggleSearch]);

  const runCommandInternal = useCallback((commandStr: string, cwd?: string): Promise<void> => {
    const term = xtermRef.current;
    if (!term) return Promise.resolve();

    const isWrangler = commandStr.startsWith('npx wrangler') || commandStr.startsWith('npx.cmd wrangler');

    let program: string;
    let args: string[];

    if (isWrangler) {
      program = 'npx.cmd';
      args = commandStr.replace(/^npx(\.cmd)? /, '').split(' ');
    } else if (selectedShell === 'powershell') {
      program = 'powershell.exe';
      args = ['-NoProfile', '-Command', commandStr];
    } else {
      program = 'cmd.exe';
      args = ['/c', commandStr];
    }

    const command = Command.create(program, args, { cwd });

    return new Promise<void>((resolve) => {
      command.on('close', (data) => {
        term.writeln(`\r\n\x1b[32mProcess exited with code ${data.code}\x1b[0m`);
        activeChildRef.current = null;
        onProcessChange?.(false);
        resolve();
      });

      command.on('error', (error) => {
        term.writeln(`\r\n\x1b[31mError: ${error}\x1b[0m`);
        activeChildRef.current = null;
        onProcessChange?.(false);
        resolve();
      });

      command.stdout.on('data', (line: string) => {
        term.writeln(line);
      });

      command.stderr.on('data', (line: string) => {
        if (isWrangler) {
          term.writeln(line);
        } else {
          term.writeln(`\x1b[31m${line}\x1b[0m`);
        }
      });

      command.spawn()
        .then((child) => {
          activeChildRef.current = child;
          onProcessChange?.(true);
        })
        .catch((err) => {
          term.writeln(`\r\n\x1b[31mFailed to execute: ${err}\x1b[0m`);
          onProcessChange?.(false);
          resolve();
        });
    });
  }, [selectedShell, onProcessChange]);

  const handlePwd = useCallback(() => {
    const cmd = selectedShell === 'powershell' ? 'pwd' : 'cd';
    xtermRef.current?.writeln(`\r\n\x1b[36m$ ${cmd}\x1b[0m`);
    runCommandInternal(cmd);
  }, [selectedShell, runCommandInternal]);

  useImperativeHandle(ref, () => ({
      executeCommand: async (commandStr: string, cwd?: string) => {
        if (!xtermRef.current) return;
        xtermRef.current.writeln(`\r\n\x1b[36m$ ${commandStr}\x1b[0m`);
        await runCommandInternal(commandStr, cwd);
      },

      executeSequential: async (commands: { command: string; cwd?: string; label?: string }[]) => {
        for (const { command, cwd, label } of commands) {
          if (!xtermRef.current) return;
          if (label) {
            xtermRef.current.writeln(`\r\n\x1b[35m▶ ${label}\x1b[0m`);
          }
          xtermRef.current.writeln(`\r\n\x1b[36m$ ${command}\x1b[0m`);
          await runCommandInternal(command, cwd);
        }
        xtermRef.current?.writeln('\r\n\x1b[32m✓ Multi-deploy finalizado.\x1b[0m');
      },

      write: (text: string) => {
        xtermRef.current?.write(text);
      },

      kill: async () => {
        if (activeChildRef.current) {
          try {
            await activeChildRef.current.kill();
            xtermRef.current?.writeln('\r\n\x1b[33mProcess killed by user.\x1b[0m');
          } catch (err) {
            xtermRef.current?.writeln(`\r\n\x1b[31mFailed to kill process: ${err}\x1b[0m`);
          } finally {
            activeChildRef.current = null;
            onProcessChange?.(false);
          }
        }
      },
    }), [runCommandInternal, onProcessChange]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12,
      cursorBlink: true,
      rows: 10,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln('\x1b[1;36mWRANGLER GM TERMINAL SESSION\x1b[0m');
    term.writeln('Waiting for interaction...\r\n');

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // Re-fit when container height changes
  useEffect(() => {
    setTimeout(() => fitAddonRef.current?.fit(), 0);
  }, [height]);

  return (
    <div className="bg-slate-950 border-t border-slate-800 overflow-hidden flex flex-col" style={{ height }}>
      {/* Toolbar */}
      <div className="h-9 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0 gap-4">
        {/* Left: label */}
        <span className="text-[10px] font-bold text-slate-600 tracking-widest uppercase whitespace-nowrap">
          Live Output
        </span>

        {/* Right: controls */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Shell selector */}
          <select
            value={selectedShell}
            onChange={(e) => onShellChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-400 text-[10px] rounded px-2 py-1 outline-none hover:border-sky-500 transition-colors cursor-pointer mr-2"
          >
            <option value="powershell">PowerShell</option>
            <option value="cmd">CMD</option>
          </select>

          {/* Search toggle */}
          <button
            onClick={toggleSearch}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
              searchOpen
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
            }`}
            title="Search (Ctrl+F)"
          >
            <Search size={11} />
            Find
          </button>

          {/* PWD */}
          <button
            onClick={handlePwd}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 border border-transparent transition-all"
            title="Print working directory"
          >
            <FolderSearch size={11} />
            pwd
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-all"
            title="Clear terminal"
          >
            <Trash2 size={11} />
            Clear
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800">
          <div className="relative flex-1 max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value, 'next');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(searchQuery, e.shiftKey ? 'prev' : 'next');
                if (e.key === 'Escape') toggleSearch();
              }}
              placeholder="Find in output..."
              className="w-full bg-slate-800 border border-slate-700 rounded pl-7 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/60"
            />
          </div>
          {searchResultCount !== null && (
            <span className="text-[10px] text-slate-500">{searchResultCount} matches</span>
          )}
          <button
            onClick={() => handleSearch(searchQuery, 'prev')}
            disabled={!searchQuery}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => handleSearch(searchQuery, 'next')}
            disabled={!searchQuery}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
            title="Next (Enter)"
          >
            <ChevronDown size={14} />
          </button>
          <button onClick={toggleSearch} className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-all">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Terminal canvas */}
      <div className="flex-1 p-2 overflow-hidden">
        <div id="terminal" className="h-full" ref={terminalRef} />
      </div>
    </div>
  );
});

export default Terminal;
