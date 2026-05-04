import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Rocket, X, Globe, FileCode, FolderOpen, Copy, List } from 'lucide-react';
import { Worker } from './WorkerCard';

export interface WorkerDeployConfig {
  worker: Worker;
  /** Absolute path to the worker's entry-point (index.js / src/index.ts, etc.) */
  indexPath: string;
}

interface MultiDeployModalProps {
  workers: Worker[];
  selectedEnv: string;
  onConfirm: (configs: WorkerDeployConfig[]) => void;
  onCancel: () => void;
}

const LS_KEY = 'worker_index_paths';
const LS_SHARED_KEY = 'worker_shared_index_path';

const loadSaved = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
};
const savePaths = (map: Record<string, string>) => {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
};

/** Step 1 (multi-worker only): ask if all workers share the same index or each has its own */
type IndexMode = 'shared' | 'individual';
type Step = 'mode-select' | 'configure';

// ── Reusable file-picker badge ─────────────────────────────────────────────
const FilePicker = ({
  value,
  onPick,
  onClear,
  title = 'Seleccionar archivo de entrada del worker',
}: {
  value: string;
  onPick: () => void;
  onClear: () => void;
  title?: string;
}) => (
  value ? (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900 border border-sky-500/30">
      <FileCode size={11} className="text-sky-400 shrink-0" />
      <span className="flex-1 text-[11px] font-mono text-sky-300 truncate" title={value}>
        {value}
      </span>
      <button
        onClick={onClear}
        className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
        title="Quitar selección"
      >
        <X size={11} />
      </button>
    </div>
  ) : (
    <button
      onClick={onPick}
      title={title}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-sky-500/50 text-[11px] text-slate-500 hover:text-sky-400 font-mono transition-all"
    >
      <FolderOpen size={12} />
      Seleccionar archivo…
    </button>
  )
);

// ── Command preview ────────────────────────────────────────────────────────
const CmdPreview = ({ index, env, config }: { index: string; env: string; config: string }) => (
  <div className="px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-700/60">
    <p className="text-[10px] font-mono text-slate-500 break-all leading-relaxed">
      <span className="text-slate-400">$</span>{' '}
      npx wrangler deploy --minify{' '}
      <span className="text-amber-400">{index}</span>
      {env !== 'default' && <span className="text-indigo-400"> --env {env}</span>}
      {' '}--config=<span className="text-sky-400">{config}</span>
    </p>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const MultiDeployModal = ({ workers, selectedEnv, onConfirm, onCancel }: MultiDeployModalProps) => {
  const isMulti = workers.length > 1;
  const saved = loadSaved();

  // Step state: single workers skip straight to 'configure'
  const [step, setStep] = useState<Step>(isMulti ? 'mode-select' : 'configure');
  const [mode, setMode] = useState<IndexMode>('shared');

  // Shared index (used in 'shared' mode)
  const [sharedIndex, setSharedIndex] = useState<string>(
    () => localStorage.getItem(LS_SHARED_KEY) ?? ''
  );

  // Per-worker index paths (used in 'individual' mode)
  const [indexPaths, setIndexPaths] = useState<Record<string, string>>(() =>
    Object.fromEntries(workers.map(w => [w.path, saved[w.path] ?? '']))
  );

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pickShared = async () => {
    const selected = await open({
      multiple: false, directory: false,
      title: 'Seleccionar archivo de entrada compartido',
      filters: [{ name: 'JS / TS', extensions: ['js', 'ts', 'mjs', 'cjs'] }],
    });
    if (selected && typeof selected === 'string') {
      setSharedIndex(selected);
      localStorage.setItem(LS_SHARED_KEY, selected);
    }
  };

  const pickIndividual = async (configPath: string) => {
    const selected = await open({
      multiple: false, directory: false,
      title: 'Seleccionar archivo de entrada del worker',
      filters: [{ name: 'JS / TS', extensions: ['js', 'ts', 'mjs', 'cjs'] }],
    });
    if (selected && typeof selected === 'string') {
      setIndexPaths(prev => ({ ...prev, [configPath]: selected }));
    }
  };

  const allHaveIndex = mode === 'shared'
    ? sharedIndex.trim().length > 0
    : workers.every(w => (indexPaths[w.path] ?? '').trim().length > 0);

  const handleConfirm = () => {
    if (mode === 'shared') {
      const configs: WorkerDeployConfig[] = workers.map(w => ({
        worker: w, indexPath: sharedIndex.trim(),
      }));
      onConfirm(configs);
    } else {
      const merged = { ...loadSaved(), ...indexPaths };
      savePaths(merged);
      const configs: WorkerDeployConfig[] = workers.map(w => ({
        worker: w, indexPath: indexPaths[w.path]?.trim() ?? '',
      }));
      onConfirm(configs);
    }
  };

  // ── Env badge (shared across steps) ──────────────────────────────────────
  const EnvBadge = () => (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-slate-500">Entorno:</span>
      <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-300">
        {selectedEnv === 'default' ? 'default (sin --env)' : `--env ${selectedEnv}`}
      </span>
    </div>
  );

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = ({ subtitle }: { subtitle?: string }) => (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-2.5">
        <Rocket size={16} className="text-indigo-400" />
        <div>
          <h2 className="text-sm font-bold text-slate-100">{isMulti ? 'Confirmar deploy múltiple' : 'Confirmar deploy'}</h2>
          {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button
        onClick={onCancel}
        className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  const Footer = ({
    onBack, backLabel = 'Atrás', confirmLabel, confirmDisabled,
  }: {
    onBack?: () => void;
    backLabel?: string;
    confirmLabel: string;
    confirmDisabled?: boolean;
  }) => (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
      <div>
        {onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            ← {backLabel}
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
        )}
      </div>
      <button
        onClick={handleConfirm}
        disabled={confirmDisabled}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Rocket size={13} />
        {confirmLabel}
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Mode selection (only for multiple workers)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'mode-select') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col">
          <Header subtitle={`${workers.length} workers seleccionados`} />

          <div className="px-6 py-6 flex flex-col gap-4">
            <EnvBadge />

            <p className="text-sm text-slate-400">
              ¿Los workers comparten el mismo archivo de entrada o cada uno tiene el suyo?
            </p>

            {/* Option cards */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode('shared')}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                  mode === 'shared'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                }`}
              >
                <Copy size={18} className={mode === 'shared' ? 'text-sky-400 mt-0.5 shrink-0' : 'text-slate-500 mt-0.5 shrink-0'} />
                <div>
                  <p className={`text-sm font-bold ${mode === 'shared' ? 'text-sky-300' : 'text-slate-300'}`}>
                    Mismo index para todos
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Se selecciona un único archivo y se usa en todos los deploys.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode('individual')}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                  mode === 'individual'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                }`}
              >
                <List size={18} className={mode === 'individual' ? 'text-indigo-400 mt-0.5 shrink-0' : 'text-slate-500 mt-0.5 shrink-0'} />
                <div>
                  <p className={`text-sm font-bold ${mode === 'individual' ? 'text-indigo-300' : 'text-slate-300'}`}>
                    Index individual por worker
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cada worker tiene su propio archivo de entrada.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => setStep('configure')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-sky-500/20"
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Configure index paths
  // ══════════════════════════════════════════════════════════════════════════

  // ── Shared mode: one picker for all ──────────────────────────────────────
  if (mode === 'shared') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col">
          <Header subtitle="Index compartido" />

          <div className="px-6 py-5 flex flex-col gap-4">
            <EnvBadge />

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FileCode size={9} /> Archivo de entrada compartido
              </label>
              <FilePicker
                value={sharedIndex}
                onPick={pickShared}
                onClear={() => { setSharedIndex(''); localStorage.removeItem(LS_SHARED_KEY); }}
                title="Seleccionar archivo de entrada compartido"
              />
            </div>

            {/* Preview for all workers */}
            {sharedIndex && (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vista previa</p>
                {workers.map(w => (
                  <CmdPreview key={w.path} index={sharedIndex} env={selectedEnv} config={w.path} />
                ))}
              </div>
            )}
          </div>

          <Footer
            onBack={() => setStep('mode-select')}
            backLabel="Cambiar modo"
            confirmLabel={`Deploy ${workers.length} worker${workers.length > 1 ? 's' : ''}`}
            confirmDisabled={!allHaveIndex}
          />
        </div>
      </div>
    );
  }

  // ── Individual mode: one picker per worker ────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        <Header subtitle={isMulti ? 'Index individual por worker' : undefined} />

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <EnvBadge />

          <div className="flex flex-col gap-3">
            {workers.map((w) => (
              <div
                key={w.path}
                className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-slate-800/50 border border-slate-800"
              >
                {/* Worker name + config */}
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-sky-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{w.name}</p>
                    <p className="text-[10px] text-slate-600 font-mono truncate" title={w.path}>
                      config: {w.relative_path}
                    </p>
                  </div>
                </div>

                {/* Per-worker picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FileCode size={9} /> Archivo de entrada
                  </label>
                  <FilePicker
                    value={indexPaths[w.path] ?? ''}
                    onPick={() => pickIndividual(w.path)}
                    onClear={() => setIndexPaths(prev => ({ ...prev, [w.path]: '' }))}
                  />
                </div>

                {/* Command preview */}
                {(indexPaths[w.path] ?? '').trim() && (
                  <CmdPreview
                    index={indexPaths[w.path].trim()}
                    env={selectedEnv}
                    config={w.path}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            {isMulti && (
              <button
                onClick={() => setStep('mode-select')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
              >
                ← Cambiar modo
              </button>
            )}
            {!isMulti && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
            )}
            <p className="text-[10px] text-slate-600">
              {allHaveIndex
                ? `${workers.length} worker${workers.length > 1 ? 's' : ''} listos`
                : 'Seleccioná todos los archivos de entrada'}
            </p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!allHaveIndex}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Rocket size={13} />
            Deploy {workers.length} worker{workers.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiDeployModal;
