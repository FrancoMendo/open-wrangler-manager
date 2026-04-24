import { useState, useMemo } from 'react';
import { ChevronRight, Folder, FolderOpen as FolderOpenIcon } from 'lucide-react';
import WorkerCard, { Worker } from './WorkerCard';

interface FolderGroupProps {
  workers: Worker[];
  onDeploy: (worker: Worker, env?: string) => void;
  onLogs: (worker: Worker, env?: string, format?: string) => void;
  onOpen: (worker: Worker) => void;
  selectedWorkers?: Set<string>;
  onSelectToggle?: (worker: Worker) => void;
}

interface FolderNode {
  name: string;
  fullPath: string;
  workers: Worker[];
  children: Map<string, FolderNode>;
}

/**
 * Build a tree structure from flat worker list using their relative_path.
 * Each worker is placed into its parent directory node.
 */
function buildFolderTree(workers: Worker[]): FolderNode {
  const root: FolderNode = {
    name: '',
    fullPath: '',
    workers: [],
    children: new Map(),
  };

  for (const worker of workers) {
    // Normalize path separators
    const relPath = worker.relative_path.replace(/\\/g, '/');
    const parts = relPath.split('/');

    // The file itself is the last part; directories are everything before
    const dirParts = parts.slice(0, -1);

    let current = root;
    let pathSoFar = '';

    for (const part of dirParts) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: pathSoFar,
          workers: [],
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }

    current.workers.push(worker);
  }

  return root;
}

/** Count total workers in a folder node (recursive) */
function countWorkers(node: FolderNode): number {
  let count = node.workers.length;
  for (const child of node.children.values()) {
    count += countWorkers(child);
  }
  return count;
}

interface FolderSectionProps {
  node: FolderNode;
  depth: number;
  onDeploy: (worker: Worker, env?: string) => void;
  onLogs: (worker: Worker, env?: string, format?: string) => void;
  onOpen: (worker: Worker) => void;
  defaultOpen?: boolean;
  selectedWorkers?: Set<string>;
  onSelectToggle?: (worker: Worker) => void;
}

const FolderSection = ({ node, depth, onDeploy, onLogs, onOpen, defaultOpen = true, selectedWorkers, onSelectToggle }: FolderSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const totalWorkers = useMemo(() => countWorkers(node), [node]);

  const sortedChildren = useMemo(() => {
    return Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [node.children]);

  // Color gradient based on depth for visual hierarchy
  const depthColors = [
    { border: 'border-sky-500/30', bg: 'bg-sky-500/5', text: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-300' },
    { border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', text: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300' },
    { border: 'border-purple-500/30', bg: 'bg-purple-500/5', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
    { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  ];
  const colorSet = depthColors[depth % depthColors.length];

  return (
    <div className={`rounded-lg ${depth > 0 ? `border ${colorSet.border} ${colorSet.bg}` : ''}`}>
      {/* Folder header - clickable to collapse/expand */}
      {node.name && (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-white/[0.02] rounded-t-lg ${!isOpen ? 'rounded-b-lg' : ''
            }`}
        >
          <ChevronRight
            size={14}
            className={`${colorSet.text} transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          {isOpen ? (
            <FolderOpenIcon size={16} className={colorSet.text} />
          ) : (
            <Folder size={16} className={colorSet.text} />
          )}
          <span className={`text-sm font-bold ${colorSet.text}`}>{node.name}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorSet.badge}`}>
            {totalWorkers}
          </span>
        </button>
      )}

      {/* Content */}
      {isOpen && (
        <div className={`flex flex-col gap-2 ${node.name ? 'px-3 pb-3' : ''}`}>
          {/* Direct workers in this folder */}
          {node.workers.map((worker, index) => (
            <WorkerCard
              key={`${worker.path}-${index}`}
              worker={worker}
              onDeploy={onDeploy}
              onLogs={onLogs}
              onOpen={() => onOpen(worker)}
              isSelected={selectedWorkers?.has(worker.path)}
              onSelectToggle={onSelectToggle}
            />
          ))}

          {/* Subfolders */}
          {sortedChildren.map(child => (
            <FolderSection
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              onDeploy={onDeploy}
              onLogs={onLogs}
              onOpen={onOpen}
              defaultOpen={false}
              selectedWorkers={selectedWorkers}
              onSelectToggle={onSelectToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderGroup = ({ workers, onDeploy, onLogs, onOpen, selectedWorkers, onSelectToggle }: FolderGroupProps) => {
  const tree = useMemo(() => buildFolderTree(workers), [workers]);

  // If all workers are in the root (no subdirectories), render flat list
  const hasSubfolders = tree.children.size > 0;

  if (!hasSubfolders) {
    return (
      <div className="flex flex-col gap-2">
        {tree.workers.map((worker, index) => (
          <WorkerCard
            key={`${worker.path}-${index}`}
            worker={worker}
            onDeploy={onDeploy}
            onLogs={onLogs}
            onOpen={() => onOpen(worker)}
            isSelected={selectedWorkers?.has(worker.path)}
            onSelectToggle={onSelectToggle}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Root-level workers (files at the base directory) */}
      {tree.workers.length > 0 && (
        <div className="flex flex-col gap-2">
          {tree.workers.map((worker, index) => (
            <WorkerCard
              key={`${worker.path}-${index}`}
              worker={worker}
              onDeploy={onDeploy}
              onLogs={onLogs}
              onOpen={() => onOpen(worker)}
              isSelected={selectedWorkers?.has(worker.path)}
              onSelectToggle={onSelectToggle}
            />
          ))}
        </div>
      )}

      {/* Subfolders */}
      {Array.from(tree.children.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(child => (
          <FolderSection
            key={child.fullPath}
            node={child}
            depth={0}
            onDeploy={onDeploy}
            onLogs={onLogs}
            onOpen={onOpen}
            defaultOpen={false}
            selectedWorkers={selectedWorkers}
            onSelectToggle={onSelectToggle}
          />
        ))}
    </div>
  );
};

export default FolderGroup;
