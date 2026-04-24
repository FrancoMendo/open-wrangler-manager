import { X, AlertTriangle, Info, AlertCircle, Trash2, Clock } from 'lucide-react';

export interface AppError {
  id: number;
  timestamp: Date;
  source: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  detail?: string;
}

interface ErrorLogPanelProps {
  errors: AppError[];
  onClear: () => void;
  onClose: () => void;
}

const levelIcon = (level: AppError['level']) => {
  if (level === 'error') return <AlertCircle size={13} className="text-red-400 shrink-0" />;
  if (level === 'warn')  return <AlertTriangle size={13} className="text-amber-400 shrink-0" />;
  return <Info size={13} className="text-sky-400 shrink-0" />;
};

const levelBg = (level: AppError['level']) => {
  if (level === 'error') return 'border-red-500/20 bg-red-500/5';
  if (level === 'warn')  return 'border-amber-500/20 bg-amber-500/5';
  return 'border-sky-500/20 bg-sky-500/5';
};

const fmt = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const ErrorLogPanel = ({ errors, onClear, onClose }: ErrorLogPanelProps) => (
  <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[420px] bg-slate-950 border-l border-slate-800 shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="text-red-400" />
        <span className="text-sm font-bold text-slate-100">Error Log</span>
        {errors.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
            {errors.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onClear}
          disabled={errors.length === 0}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-all"
        >
          <Trash2 size={11} />
          Clear
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>

    {/* List */}
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
      {errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-600">
          <Info size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No errors recorded</p>
        </div>
      ) : (
        [...errors].reverse().map(err => (
          <div
            key={err.id}
            className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border ${levelBg(err.level)}`}
          >
            <div className="flex items-start gap-2">
              {levelIcon(err.level)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {err.source}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-600 shrink-0">
                    <Clock size={9} />
                    {fmt(err.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{err.message}</p>
                {err.detail && (
                  <p className="text-[10px] font-mono text-slate-500 mt-1 break-all leading-relaxed">
                    {err.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default ErrorLogPanel;
