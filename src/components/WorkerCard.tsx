import { useState } from 'react';
import { Rocket, Activity, ChevronDown, Globe, Folder } from 'lucide-react';

export interface Worker {
  name: string;
  path: string;
  relative_path: string;
  environments: string[];
}

interface WorkerCardProps {
  worker: Worker;
  onDeploy: (worker: Worker, env?: string) => void;
  onLogs: (worker: Worker, env?: string, format?: string) => void;
  onOpen: (worker: Worker) => void;
  isSelected?: boolean;
  onSelectToggle?: (worker: Worker) => void;
}

const WorkerCard = ({ worker, onDeploy, onLogs, onOpen: _onOpen, isSelected = false, onSelectToggle }: WorkerCardProps) => {
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [envOpen, setEnvOpen] = useState(false);
  const [logFormat, setLogFormat] = useState<'pretty' | 'json'>('pretty');

  const allEnvs = ['default', ...worker.environments];
  const displayEnv = selectedEnv ?? 'default';

  return (
    <div className={`group bg-slate-900/50 border rounded-lg transition-all duration-200 hover:shadow-lg ${isSelected ? 'border-indigo-500/60 shadow-indigo-500/10' : 'border-slate-800 hover:border-sky-500/40 hover:shadow-sky-500/5'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        {onSelectToggle && (
          <button
            onClick={() => onSelectToggle(worker)}
            className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-indigo-500 border-indigo-500'
                : 'border-slate-600 bg-transparent opacity-0 group-hover:opacity-100 hover:border-indigo-400'
            }`}
            title={isSelected ? 'Deseleccionar' : 'Seleccionar para deploy múltiple'}
          >
            {isSelected && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        {/* Icon */}
        <Globe size={14} className="text-sky-400 shrink-0" />

        {/* Name + path */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 leading-none truncate">{worker.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Folder size={10} className="text-slate-600 shrink-0" />
            <p className="text-[10px] text-slate-600 font-mono truncate" title={worker.path}>
              {worker.relative_path}
            </p>
          </div>
        </div>

        {/* Env selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setEnvOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 bg-slate-800/60 hover:border-sky-500/40 text-[10px] font-bold text-slate-400 hover:text-sky-400 transition-all"
          >
            {displayEnv}
            <ChevronDown size={10} className={`transition-transform ${envOpen ? 'rotate-180' : ''}`} />
          </button>

          {envOpen && (
            <div className="absolute right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-30 min-w-[120px] py-1 overflow-hidden">
              {allEnvs.map(env => (
                <button
                  key={env}
                  onClick={() => {
                    setSelectedEnv(env === 'default' ? null : env);
                    setEnvOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors ${displayEnv === env
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                >
                  {env}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Log format toggle */}
          <div className="flex rounded border border-slate-700 overflow-hidden text-[10px] font-bold">
            <button
              onClick={() => setLogFormat('pretty')}
              className={`px-2 py-1.5 transition-colors ${logFormat === 'pretty'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
                }`}
              title="Pretty format"
            >
              pretty
            </button>
            <button
              onClick={() => setLogFormat('json')}
              className={`px-2 py-1.5 transition-colors border-l border-slate-700 ${logFormat === 'json'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
                }`}
              title="JSON format"
            >
              json
            </button>
          </div>

          <button
            onClick={() => onDeploy(worker, selectedEnv ?? undefined)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border border-sky-500/20 text-[11px] font-bold transition-all"
            title={`Deploy${selectedEnv ? ` (--env ${selectedEnv})` : ''}`}
          >
            <Rocket size={12} />
            Deploy
          </button>
          <button
            onClick={() => onLogs(worker, selectedEnv ?? undefined, logFormat)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px] font-bold transition-all"
            title={`Tail logs (--format ${logFormat}${selectedEnv ? `, --env ${selectedEnv}` : ''})`}
          >
            <Activity size={12} />
            Logs
          </button>
        </div>
      </div>

      {/* Active env indicator  */}
      {selectedEnv && (
        <div className="px-4 pb-2 -mt-1">
          <span className="text-[9px] font-mono text-indigo-400/70">→ --env {selectedEnv}</span>
        </div>
      )}
    </div>
  );
};

export default WorkerCard;
