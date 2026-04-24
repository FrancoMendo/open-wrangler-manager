import { Rocket, X, Globe } from 'lucide-react';
import { Worker } from './WorkerCard';

interface MultiDeployModalProps {
  workers: Worker[];
  selectedEnv: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const MultiDeployModal = ({ workers, selectedEnv, onConfirm, onCancel }: MultiDeployModalProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Rocket size={16} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-100">Confirmar deploy múltiple</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-400">
            Se van a deployar <span className="font-bold text-slate-200">{workers.length} workers</span> con el siguiente entorno:
          </p>

          {/* Env badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Entorno:</span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-300">
              {selectedEnv === 'default' ? 'default (sin --env)' : `--env ${selectedEnv}`}
            </span>
          </div>

          {/* Worker list */}
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {workers.map((w) => (
              <div
                key={w.path}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-800"
              >
                <Globe size={12} className="text-sky-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{w.name}</p>
                  <p className="text-[10px] text-slate-600 font-mono truncate">{w.relative_path}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Rocket size={13} />
            Confirmar deploy
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiDeployModal;
