import { Settings, X, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export const DEFAULT_DEPLOY_TEMPLATE = 'npx wrangler deploy --minify {env}';

interface DeploySettingsModalProps {
  template: string;
  deployDir: string;
  onSave: (template: string, deployDir: string) => void;
  onCancel: () => void;
}

const TOKENS = [
  ['{config}', 'Ruta absoluta al wrangler.toml (si necesitás pasarlo explícitamente con --config)'],
  ['{name}',   'Nombre del worker (campo name del toml)'],
  ['{env}',    'Flag de entorno: --env <nombre> (vacío si es default)'],
] as const;

const EXAMPLE_DIR = 'C:\\proyectos\\api\\workers\\login';
const EXAMPLE_CONFIG = `${EXAMPLE_DIR}\\wrangler.toml`;

const DeploySettingsModal = ({ template, deployDir, onSave, onCancel }: DeploySettingsModalProps) => {
  const [value, setValue] = useState(template);
  const [dirValue, setDirValue] = useState(deployDir);

  const preview = value
    .replace('{config}', EXAMPLE_CONFIG)
    .replace('{name}', 'backoffice-login')
    .replace('{env}', '--env staging')
    .trim()
    .replace(/\s{2,}/g, ' ');

  const dirPreview = dirValue
    ? dirValue.replace('{dir}', EXAMPLE_DIR)
    : EXAMPLE_DIR;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings size={16} className="text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100">Configuración de deploy</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* ── Comando ── */}
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              Personalizá el comando que se ejecuta al hacer deploy. Los marcadores se reemplazan por los valores del worker seleccionado.
            </p>

            {/* Token reference */}
            <div className="flex flex-col gap-2 bg-slate-800/40 rounded-lg px-4 py-3 border border-slate-800">
              {TOKENS.map(([token, desc]) => (
                <div key={token} className="flex items-center gap-3">
                  <code className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700 text-sky-300 text-[10px] font-mono">
                    {token}
                  </code>
                  <span className="text-[11px] text-slate-500">{desc}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comando</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500/60 transition-colors"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vista previa — comando</label>
              <code className="bg-slate-800/60 border border-slate-800 rounded px-3 py-2 text-[11px] text-slate-400 font-mono break-all leading-relaxed">
                {preview}
              </code>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* ── Directorio de trabajo ── */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-slate-400">
                Directorio desde donde se ejecuta el comando. Por defecto es el directorio del archivo de configuración del worker (wrangler.toml), de modo que wrangler lo detecte automáticamente.
              </p>
              <div className="flex items-center gap-2 mt-2 bg-slate-800/40 rounded-lg px-4 py-2 border border-slate-800">
                <code className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700 text-sky-300 text-[10px] font-mono">{'{dir}'}</code>
                <span className="text-[11px] text-slate-500">Directorio del archivo de config del worker (wrangler.toml / wrangler.jsonc)</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Directorio de trabajo</label>
              <input
                type="text"
                value={dirValue}
                onChange={(e) => setDirValue(e.target.value)}
                placeholder="Vacío = directorio del worker"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500/60 transition-colors placeholder-slate-600"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vista previa — cwd</label>
              <code className="bg-slate-800/60 border border-slate-800 rounded px-3 py-2 text-[11px] text-slate-400 font-mono break-all leading-relaxed">
                {dirPreview}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button
            onClick={() => { setValue(DEFAULT_DEPLOY_TEMPLATE); setDirValue(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            title="Restaurar valor por defecto"
          >
            <RotateCcw size={11} />
            Restaurar default
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(value.trim(), dirValue.trim())}
              disabled={!value.trim()}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploySettingsModal;
