import React, { useState, useEffect } from 'react';
import {
  Archive,
  Download,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import {
  CollectionInfo,
  RestoreInspectResponse,
  BackupDatabaseResponse,
  RestoreCommitResponse,
} from '@shared/ipc-types';

interface BackupRestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  isReadOnly?: boolean;
}

export const BackupRestoreDialog: React.FC<BackupRestoreDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  isReadOnly,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');

  // Backup state
  const [loadingCols, setLoadingCols] = useState(false);
  const [availableCols, setAvailableCols] = useState<CollectionInfo[]>([]);
  const [selectedCols, setSelectedCols] = useState<Record<string, boolean>>({});
  const [backupPath, setBackupPath] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupDatabaseResponse | null>(null);

  // Restore state
  const [restoreFilePath, setRestoreFilePath] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [restoreInspect, setRestoreInspect] = useState<RestoreInspectResponse | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<'overwrite' | 'skip'>('overwrite');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreCommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load collections on mount
  useEffect(() => {
    if (!isOpen || !connectionId) return;

    setLoadingCols(true);
    setError(null);
    window.api
      .listCollections({ connectionId })
      .then((cols) => {
        setAvailableCols(cols);
        const map: Record<string, boolean> = {};
        cols.forEach((c) => (map[c.path] = true));
        setSelectedCols(map);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoadingCols(false);
      });
  }, [isOpen, connectionId]);

  if (!isOpen) return null;

  const handleSelectAllCols = (val: boolean) => {
    const next: Record<string, boolean> = {};
    availableCols.forEach((c) => (next[c.path] = val));
    setSelectedCols(next);
  };

  const handleBrowseSaveLocation = async () => {
    const defaultName = `firestore-backup-${new Date().toISOString().slice(0, 10)}.fired-backup`;
    const selected = await window.api.saveFileDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Fired Backup Archive', extensions: ['fired-backup', 'firefoo-backup', 'json'] }],
    });
    if (selected) {
      setBackupPath(selected);
      setBackupResult(null);
    }
  };

  const handleStartBackup = async () => {
    if (!backupPath) {
      setError('Please choose a file save location first.');
      return;
    }

    setBackingUp(true);
    setError(null);
    setBackupResult(null);

    try {
      const chosenPaths = Object.keys(selectedCols).filter((k) => selectedCols[k]);
      const res = await window.api.backupDatabase({
        connectionId,
        collectionPaths: chosenPaths,
        filePath: backupPath,
      });

      if (!res.success) {
        setError(res.error || 'Backup failed.');
      } else {
        setBackupResult(res);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleBrowseRestoreFile = async () => {
    const selected = await window.api.openFileDialog({
      filters: [
        { name: 'Fired Backup Archive', extensions: ['fired-backup', 'firefoo-backup', 'json'] },
      ],
    });
    if (!selected) return;

    setRestoreFilePath(selected);
    setInspecting(true);
    setError(null);
    setRestoreResult(null);

    try {
      const inspect = await window.api.inspectRestore({ filePath: selected });
      if (!inspect.success) {
        setError(inspect.error || 'Invalid backup file.');
        setRestoreInspect(null);
      } else {
        setRestoreInspect(inspect);
      }
    } catch (err) {
      setError((err as Error).message);
      setRestoreInspect(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleStartRestore = async () => {
    if (!restoreFilePath || !restoreInspect) return;

    if (isReadOnly) {
      setError('Permission denied: Connection is in read-only mode.');
      return;
    }

    setRestoring(true);
    setError(null);
    setRestoreResult(null);

    try {
      const res = await window.api.commitRestore({
        connectionId,
        filePath: restoreFilePath,
        strategy: restoreStrategy,
      });

      if (!res.success) {
        setError(res.error || 'Restore failed.');
      } else {
        setRestoreResult(res);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5 bg-[#161b22]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Database Backup & Restore</h3>
              <p className="text-[11px] text-gray-400">
                Multi-collection structured archives with automated schema preservation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#30363d] bg-[#0d1117] text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('backup');
              setError(null);
            }}
            className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'backup'
                ? 'border-amber-500 text-white bg-[#161b22]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span>Backup Collections</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              setError(null);
            }}
            className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'restore'
                ? 'border-amber-500 text-white bg-[#161b22]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-indigo-400" />
            <span>Restore Archive</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeTab === 'backup' ? (
            <div className="space-y-4">
              {/* Collection Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300">
                    Select Collections to Include ({Object.values(selectedCols).filter(Boolean).length}/{availableCols.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllCols(true)}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllCols(false)}
                      className="text-[11px] text-gray-400 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#30363d] bg-[#0d1117] p-2 space-y-1">
                  {loadingCols ? (
                    <div className="flex items-center justify-center py-4 text-gray-500 gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                      <span>Scanning database collections...</span>
                    </div>
                  ) : availableCols.length === 0 ? (
                    <div className="text-gray-500 italic py-2 text-center">No collections found.</div>
                  ) : (
                    availableCols.map((col) => (
                      <label
                        key={col.path}
                        className="flex items-center gap-2 p-1 rounded hover:bg-[#161b22] cursor-pointer text-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedCols[col.path]}
                          onChange={(e) =>
                            setSelectedCols((prev) => ({ ...prev, [col.path]: e.target.checked }))
                          }
                          className="rounded border-[#30363d] bg-[#0d1117] text-amber-500 focus:ring-amber-500"
                        />
                        <Layers className="h-3.5 w-3.5 text-amber-400" />
                        <span className="truncate">{col.path}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Destination file path */}
              <div className="space-y-1.5">
                <span className="font-semibold text-gray-300 block">Backup Destination File</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={backupPath}
                    placeholder="Choose file destination (*.fired-backup)..."
                    className="flex-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseSaveLocation}
                    className="rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Browse...
                  </button>
                </div>
              </div>

              {/* Success Result */}
              {backupResult && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Backup Complete!</span>
                    <p className="text-[11px] text-emerald-200/90 mt-0.5">
                      Exported {backupResult.totalDocuments} documents across {backupResult.totalCollections} collections.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File picker */}
              <div className="space-y-1.5">
                <span className="font-semibold text-gray-300 block">Select Backup Archive</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={restoreFilePath}
                    placeholder="Select .fired-backup archive..."
                    className="flex-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseRestoreFile}
                    className="rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Select File...
                  </button>
                </div>
              </div>

              {/* Pre-flight Inspector */}
              {inspecting ? (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  <span>Inspecting archive manifest...</span>
                </div>
              ) : restoreInspect ? (
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#21262d] pb-2">
                    <span className="font-semibold text-white">Archive Pre-Flight Inspection</span>
                    <span className="text-[11px] text-amber-400 font-mono">
                      {restoreInspect.totalDocuments} Documents Total
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                    <div>Source Project: <span className="font-mono text-gray-200">{restoreInspect.projectId}</span></div>
                    <div>Created: <span className="text-gray-200">{new Date(restoreInspect.timestamp).toLocaleDateString()}</span></div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                      Collections in Archive ({restoreInspect.collections.length})
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px]">
                      {restoreInspect.collections.map((col) => (
                        <div key={col.name} className="flex items-center justify-between text-gray-300">
                          <span>{col.name}</span>
                          <span className="text-gray-500">{col.docCount} docs</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategy Choice */}
                  <div className="pt-2 border-t border-[#21262d] space-y-1">
                    <span className="font-semibold text-gray-300 block text-[11px]">Conflict Strategy:</span>
                    <div className="flex items-center gap-4 text-[11px]">
                      <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreStrategy"
                          checked={restoreStrategy === 'overwrite'}
                          onChange={() => setRestoreStrategy('overwrite')}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span>Overwrite existing docs</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreStrategy"
                          checked={restoreStrategy === 'skip'}
                          onChange={() => setRestoreStrategy('skip')}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span>Skip existing docs</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Restore Result */}
              {restoreResult && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Restore Complete!</span>
                    <p className="text-[11px] text-emerald-200/90 mt-0.5">
                      Wrote {restoreResult.committed} documents in {restoreResult.batchCount} batch writes.{' '}
                      {restoreResult.skipped > 0 && `Skipped ${restoreResult.skipped} existing docs.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <span className="text-[11px] text-gray-500">
            Batch write chunks: 500 limit. Safe & transactional.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>

            {activeTab === 'backup' ? (
              <button
                type="button"
                disabled={backingUp || !backupPath || Object.values(selectedCols).filter(Boolean).length === 0}
                onClick={handleStartBackup}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
              >
                {backingUp ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Backing up...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Start Backup</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={restoring || !restoreInspect || isReadOnly}
                onClick={handleStartRestore}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
              >
                {restoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Restoring batches...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Commit Restore</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
