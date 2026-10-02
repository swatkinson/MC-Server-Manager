import { useMemo, useState } from 'react';
import type { ModConfigFile } from '../types/api';
import { Icon } from './icons/Icon';

interface TreeNode {
  name: string;
  path: string;
  dirs: Map<string, TreeNode>;
  files: ModConfigFile[];
}

function buildTree(files: ModConfigFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let child = node.dirs.get(part);
      if (!child) {
        child = { name: part, path: node.path ? `${node.path}/${part}` : part, dirs: new Map(), files: [] };
        node.dirs.set(part, child);
      }
      node = child;
    }
    node.files.push(f);
  }
  return root;
}

interface ConfigFileTreeProps {
  files: ModConfigFile[];
  query: string;
  selected: string | null;
  onSelect: (path: string) => void;
}

export function ConfigFileTree({ files, query, selected, onSelect }: ConfigFileTreeProps) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTree(files), [files]);
  const q = query.trim().toLowerCase();

  if (q) {
    const matches = files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 300);
    if (!matches.length) return <div className="empty-state empty-state--small">No files match “{query}”</div>;
    return (
      <ul className="file-tree">
        {matches.map((f) => (
          <FileRow key={f.path} label={f.path} path={f.path} depth={0} selected={selected} onSelect={onSelect} />
        ))}
      </ul>
    );
  }

  const toggle = (path: string) =>
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => (
    <>
      {[...node.dirs.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((dir) => {
          const isOpen = openDirs.has(dir.path) || (selected?.startsWith(`${dir.path}/`) ?? false);
          return (
            <li key={`d:${dir.path}`}>
              <button
                className="file-tree__row file-tree__row--dir"
                style={{ paddingLeft: `${0.6 + depth * 0.9}rem` }}
                onClick={() => toggle(dir.path)}
                aria-expanded={isOpen}
              >
                <Icon name="chevron" size={14} className={`file-tree__chevron ${isOpen ? 'file-tree__chevron--open' : ''}`} />
                <Icon name="folder" size={15} />
                <span className="file-tree__name">{dir.name}</span>
              </button>
              {isOpen && <ul className="file-tree">{renderNode(dir, depth + 1)}</ul>}
            </li>
          );
        })}
      {node.files.map((f) => (
        <FileRow key={f.path} label={f.path.split('/').pop() ?? f.path} path={f.path} depth={depth} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );

  return <ul className="file-tree">{renderNode(tree, 0)}</ul>;
}

function FileRow({
  label,
  path,
  depth,
  selected,
  onSelect,
}: {
  label: string;
  path: string;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const ext = label.includes('.') ? label.split('.').pop() : '';
  return (
    <li>
      <button
        className={`file-tree__row ${selected === path ? 'file-tree__row--active' : ''}`}
        style={{ paddingLeft: `${1.55 + depth * 0.9}rem` }}
        onClick={() => onSelect(path)}
        title={path}
      >
        <span className="file-tree__name">{label}</span>
        {ext && <span className={`file-tree__ext file-tree__ext--${ext}`}>{ext}</span>}
      </button>
    </li>
  );
}
