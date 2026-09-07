import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Database,
  Folder,
  Terminal,
  Archive,
  Lock,
  Unlock,
  Radio,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../../store';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScriptRunner: () => void;
  onOpenBackupRestore: () => void;
  onOpenAddConnection: () => void;
  onToggleLiveMode?: () => void;
  isLiveMode?: boolean;
}

interface PaletteItem {
  id: string;
  category: 'Actions' | 'Collections' | 'Projects';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenScriptRunner,
  onOpenBackupRestore,
  onOpenAddConnection,
  onToggleLiveMode,
  isLiveMode,
}) => {
  const {
    connections,
    activeConnectionId,
    collectionsByConnection,
    setActiveConnectionId,
    setActiveCollectionPath,
    updateConnectionReadOnly,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const activeCollections = activeConnectionId ? collectionsByConnection[activeConnectionId] || [] : [];
  const isReadOnly = !!activeConnection?.readOnly;

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];

    // Global Actions
    list.push({
      id: 'act-add-connection',
      category: 'Actions',
      title: 'Connect Firebase Project...',
      subtitle: 'Add new connection via Service Account or Google OAuth',
      icon: <Plus className="h-4 w-4 text-amber-400" />,
      action: () => {
        onClose();
        onOpenAddConnection();
      },
    });

    if (activeConnectionId) {
      list.push({
        id: 'act-script-shell',
        category: 'Actions',
        title: 'Open JavaScript / Node Script Shell',
        subtitle: 'Execute custom async scripts against active Firestore database (Ctrl+Shift+S)',
        icon: <Terminal className="h-4 w-4 text-emerald-400" />,
        action: () => {
          onClose();
          onOpenScriptRunner();
        },
      });

      list.push({
        id: 'act-backup-restore',
        category: 'Actions',
        title: 'Backup & Restore Database...',
        subtitle: 'Export or import full database archive (Ctrl+Shift+B)',
        icon: <Archive className="h-4 w-4 text-indigo-400" />,
        action: () => {
          onClose();
          onOpenBackupRestore();
        },
      });

      list.push({
        id: 'act-toggle-readonly',
        category: 'Actions',
        title: isReadOnly ? 'Disable Read-Only Mode (Unlock Writes)' : 'Enable Read-Only Mode (Lock Writes)',
        subtitle: `Currently ${isReadOnly ? 'LOCKED' : 'WRITABLE'}`,
        icon: isReadOnly ? <Unlock className="h-4 w-4 text-amber-400" /> : <Lock className="h-4 w-4 text-amber-400" />,
        action: async () => {
          onClose();
          const next = !isReadOnly;
          await window.api.updateReadOnly({ connectionId: activeConnectionId, readOnly: next });
          updateConnectionReadOnly(activeConnectionId, next);
        },
      });

      if (onToggleLiveMode) {
        list.push({
          id: 'act-toggle-live',
          category: 'Actions',
          title: isLiveMode ? 'Disable Real-Time Live Mode' : 'Enable Real-Time onSnapshot Live Mode',
          subtitle: `Currently ${isLiveMode ? 'STREAMING LIVE' : 'OFF'}`,
          icon: <Radio className="h-4 w-4 text-rose-400" />,
          action: () => {
            onClose();
            onToggleLiveMode();
          },
        });
      }
    }

    // Collections under active project
    for (const col of activeCollections) {
      list.push({
        id: `col-${col.path}`,
        category: 'Collections',
        title: col.id,
        subtitle: col.path,
        icon: <Folder className="h-4 w-4 text-amber-400 fill-amber-400/20" />,
        action: () => {
          onClose();
          setActiveCollectionPath(col.path);
        },
      });
    }

    // Projects list
    for (const conn of connections) {
      list.push({
        id: `proj-${conn.id}`,
        category: 'Projects',
        title: conn.name,
        subtitle: `${conn.projectId} • ${conn.authType || 'serviceAccount'}`,
        icon: <Database className="h-4 w-4 text-blue-400" />,
        action: () => {
          onClose();
          setActiveConnectionId(conn.id);
        },
      });
    }

    // Filter by query
    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [
    connections,
    activeConnectionId,
    activeCollections,
    isReadOnly,
    isLiveMode,
    query,
    onClose,
    onOpenScriptRunner,
    onOpenBackupRestore,
    onOpenAddConnection,
    onToggleLiveMode,
    setActiveCollectionPath,
    setActiveConnectionId,
    updateConnectionReadOnly,
  ]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs pt-20 p-4 animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search collections, projects, or actions... (Esc to close)"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[#30363d] bg-[#161b22] px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 text-xs divide-y divide-transparent">
          {items.length === 0 ? (
            <div className="py-8 text-center text-gray-500 italic">No matching results found.</div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-500/15 text-white' : 'text-gray-300 hover:bg-[#21262d]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="truncate">
                      <div className="font-medium text-white truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[10.5px] text-gray-400 font-mono truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider shrink-0 ml-2">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#30363d] bg-[#0d1117] text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Fired Command Palette</span>
        </div>
      </div>
    </div>
  );
};
