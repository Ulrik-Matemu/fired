import { useEffect, useState } from 'react';
import {
  Flame,
  Plus,
  FolderTree,
  Folder,
  Search,
  Terminal,
  Archive,
  Download,
} from 'lucide-react';
import { useAppStore } from './store';
import { AddConnectionDialog } from './components/connections/AddConnectionDialog';
import { ConnectionItem } from './components/connections/ConnectionItem';
import { DocumentGrid } from './components/documents/DocumentGrid';
import { CommandPalette } from './components/palette/CommandPalette';
import { ScriptRunnerDialog } from './components/script/ScriptRunnerDialog';
import { BackupRestoreDialog } from './components/backup/BackupRestoreDialog';

function App(): React.JSX.Element {
  const {
    sidebarOpen,
    toggleSidebar,
    connections,
    setConnections,
    activeConnectionId,
    setActiveConnectionId,
    activeCollectionPath,
  } = useAppStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isScriptRunnerOpen, setIsScriptRunnerOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    async function loadSavedConnections() {
      try {
        const saved = await window.api.listConnections();
        setConnections(saved);
      } catch (err) {
        console.error('Failed to load connections from secure store:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadSavedConnections();
  }, [setConnections]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      // Toggle Sidebar: Ctrl+B or Cmd+B
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      }
      // Script Shell: Ctrl+Shift+S or Cmd+Shift+S
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeConnectionId) {
          setIsScriptRunnerOpen(true);
        }
      }
      // Backup & Restore: Ctrl+Shift+B or Cmd+Shift+B
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (activeConnectionId) {
          setIsBackupRestoreOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConnectionId, toggleSidebar]);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-[#c9d1d9]">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[#30363d] bg-[#161b22] transition-all duration-200 ${
          sidebarOpen ? 'w-72' : 'w-14'
        }`}
      >
        {/* App Title & Header */}
        {sidebarOpen ? (
          <div className="flex h-12 items-center justify-between px-3 border-b border-[#30363d]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 shadow-xs">
                <Flame className="h-4 w-4 fill-amber-400/20 text-amber-400" />
              </div>
              <span className="font-bold text-white tracking-wide text-sm">Fired</span>
            </div>
            <button
              onClick={toggleSidebar}
              className="text-xs text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#21262d] transition-colors cursor-pointer"
              title="Collapse Sidebar (Ctrl+B)"
            >
              «
            </button>
          </div>
        ) : (
          <div className="flex h-12 items-center justify-center border-b border-[#30363d] w-full">
            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Expand Sidebar (Ctrl+B)"
            >
              <Flame className="h-4 w-4 fill-amber-400/20" />
            </button>
          </div>
        )}

        {/* Connections Section */}
        <div className="flex-1 overflow-y-auto p-2">
          {sidebarOpen ? (
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Projects</span>
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-[#21262d] rounded cursor-pointer transition-colors"
                  title="Connect Firebase Project"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {loadingInitial ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Loading saved connections...
                </div>
              ) : connections.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-[#30363d] p-4 text-center">
                  <p className="text-xs text-gray-400 mb-2.5">No Firebase projects connected yet.</p>
                  <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-medium px-3 py-1.5 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Connect Project</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1 mt-1">
                  {connections.map((conn) => (
                    <ConnectionItem key={conn.id} connection={conn} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Clean Collapsed Project Switchers */
            <div className="flex flex-col items-center gap-2 pt-1">
              {connections.map((conn) => {
                const isActive = conn.id === activeConnectionId;
                return (
                  <button
                    key={conn.id}
                    onClick={() => setActiveConnectionId(conn.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer relative ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
                        : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'
                    }`}
                    title={`${conn.name} (${conn.projectId})`}
                  >
                    <Flame className={`h-4 w-4 ${isActive ? 'fill-amber-400/20 text-amber-400' : 'text-gray-400'}`} />
                    {isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#161b22]" />
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer border border-dashed border-[#30363d] mt-1"
                title="Connect Firebase Project"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Demo Mode Notice Banner */}
        {typeof window !== 'undefined' && Boolean((window as unknown as { __IS_DEMO_MODE__?: boolean }).__IS_DEMO_MODE__) && (
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 text-xs text-amber-300">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              <span className="truncate">
                <strong>Interactive Demo Mode:</strong> Exploring sample Firestore data in-browser. Mutations are safely in-memory.
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.api.openExternalUrl('https://github.com/<your-github-username>/fired/releases')}
              className="ml-3 inline-flex shrink-0 items-center gap-1 rounded bg-amber-600/20 hover:bg-amber-600/30 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>Download Desktop App</span>
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="flex h-12 items-center justify-between border-b border-[#30363d] bg-[#161b22] px-4">
          <div className="flex items-center gap-2 text-xs text-gray-300 min-w-0">
            {activeConnection ? (
              <>
                <Flame className="h-4 w-4 text-amber-400 fill-amber-400/20 shrink-0" />
                <span className="font-semibold text-white truncate">{activeConnection.name}</span>
                <span className="text-gray-500 shrink-0">/</span>
                {activeCollectionPath ? (
                  <span className="flex items-center gap-1 text-amber-300 font-medium truncate">
                    <Folder className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
                    <span className="truncate">{activeCollectionPath}</span>
                  </span>
                ) : (
                  <span className="text-gray-500 italic shrink-0">No collection selected</span>
                )}
              </>
            ) : (
              <>
                <FolderTree className="h-4 w-4 text-gray-500 shrink-0" />
                <span className="text-gray-400 truncate">Select a project and collection to start</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Command Palette Search Launcher */}
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] hover:border-amber-500/50 px-2.5 py-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer shadow-inner"
              title="Search collections, projects, and actions (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Search...</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-[#30363d] bg-[#161b22] px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
                ⌘K
              </kbd>
            </button>

            {activeConnection && (
              <>
                <button
                  type="button"
                  onClick={() => setIsScriptRunnerOpen(true)}
                  className="p-1.5 rounded-lg text-emerald-400 hover:bg-[#21262d] transition-colors cursor-pointer"
                  title="JavaScript Script Runner (Ctrl+Shift+S)"
                >
                  <Terminal className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsBackupRestoreOpen(true)}
                  className="p-1.5 rounded-lg text-indigo-400 hover:bg-[#21262d] transition-colors cursor-pointer"
                  title="Database Backup & Restore (Ctrl+Shift+B)"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden bg-[#0d1117]">
          {activeConnectionId && activeCollectionPath ? (
            <DocumentGrid
              connectionId={activeConnectionId}
              collectionPath={activeCollectionPath}
            />
          ) : activeConnection ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#161b22] text-gray-400 border border-[#30363d]">
                  <FolderTree className="h-7 w-7 text-amber-400" />
                </div>
                <h2 className="text-base font-semibold text-white mb-1">
                  {activeConnection.name}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Expand this project in the sidebar and click any collection to inspect documents.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setIsPaletteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-medium px-3 py-1.5 border border-[#363b42] transition-colors cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5 text-amber-400" />
                    <span>Open Palette (Ctrl+K)</span>
                  </button>
                  <button
                    onClick={() => setIsScriptRunnerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium px-3 py-1.5 border border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Script Shell</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                  <Flame className="h-7 w-7 fill-amber-400/20 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Welcome to Fired</h2>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  Fast, intuitive, and secure Firestore desktop client. Connect using a Service Account JSON
                  or Google OAuth to explore collections, run live real-time listeners, and manage documents.
                </p>
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 transition-colors shadow-md cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Connect Firebase Project</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Clean Status Bar */}
        <footer className="flex h-7 items-center justify-between border-t border-[#30363d] bg-[#161b22] px-3 text-[11px] text-gray-400">
          <div className="flex items-center gap-2 truncate">
            {activeConnection ? (
              <span className="flex items-center gap-1.5 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-gray-300 font-medium truncate">{activeConnection.name}</span>
                <span className="text-gray-500 font-mono truncate">({activeConnection.projectId})</span>
              </span>
            ) : (
              <span>No project active</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-gray-500 shrink-0">
            <span>⌘K Palette</span>
            <span>⌘R Refresh</span>
            <span className="text-amber-400/70 font-semibold">Fired Desktop</span>
          </div>
        </footer>
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenScriptRunner={() => setIsScriptRunnerOpen(true)}
        onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
        onOpenAddConnection={() => setIsAddDialogOpen(true)}
      />

      {/* Add Connection Modal */}
      <AddConnectionDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />

      {/* Standalone Script Runner Modal */}
      {activeConnectionId && (
        <ScriptRunnerDialog
          isOpen={isScriptRunnerOpen}
          onClose={() => setIsScriptRunnerOpen(false)}
          connectionId={activeConnectionId}
          collectionPath={activeCollectionPath || undefined}
        />
      )}

      {/* Standalone Database Backup & Restore Modal */}
      {activeConnectionId && (
        <BackupRestoreDialog
          isOpen={isBackupRestoreOpen}
          onClose={() => setIsBackupRestoreOpen(false)}
          connectionId={activeConnectionId}
          isReadOnly={!!activeConnection?.readOnly}
        />
      )}
    </div>
  );
}

export default App;
