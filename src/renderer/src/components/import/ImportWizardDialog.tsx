import React, { useState } from 'react';
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ImportPlanResponse,
  ResolvedConflictItem,
} from '@shared/ipc-types';
import { SerializedFieldValue } from '@shared/firestore-types';

interface ImportWizardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  collectionPath: string;
  onSuccess: () => void;
}

function renderFieldVal(v: SerializedFieldValue | undefined): string {
  if (!v) return '—';
  if (v.__type === 'null') return 'null';
  if (typeof v.value === 'object') return JSON.stringify(v.value);
  return String(v.value);
}

export const ImportWizardDialog: React.FC<ImportWizardDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  collectionPath,
  onSuccess,
}) => {
  const [filePath, setFilePath] = useState('');
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<ImportPlanResponse | null>(null);

  // User conflict decisions: docId -> 'overwrite' | 'skip'
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip'>>({});
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  // Commit state
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    committed: number;
    skipped: number;
    batchCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseFile = async () => {
    const selected = await window.api.openFileDialog({
      filters: [
        { name: 'JSON or CSV Data', extensions: ['json', 'csv'] },
        { name: 'JSON Document Array', extensions: ['json'] },
        { name: 'CSV Spreadsheet', extensions: ['csv'] },
      ],
    });
    if (selected) {
      setFilePath(selected);
      setPlan(null);
      setResolutions({});
      setError(null);
      setCommitResult(null);
    }
  };

  const handleRunPlan = async () => {
    if (!filePath) return;
    setPlanning(true);
    setError(null);

    try {
      const planRes = await window.api.planImport({
        connectionId,
        collectionPath,
        filePath,
      });

      if (!planRes.success) {
        setError(planRes.error || 'Failed to analyze import file.');
      } else {
        setPlan(planRes);
        // Default all conflicts to 'overwrite'
        const initialRes: Record<string, 'overwrite' | 'skip'> = {};
        for (const c of planRes.conflicts) {
          initialRes[c.documentId] = 'overwrite';
        }
        setResolutions(initialRes);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const handleSetAllResolutions = (action: 'overwrite' | 'skip') => {
    if (!plan) return;
    const updated: Record<string, 'overwrite' | 'skip'> = {};
    for (const c of plan.conflicts) {
      updated[c.documentId] = action;
    }
    setResolutions(updated);
  };

  const handleCommit = async () => {
    if (!plan) return;
    setCommitting(true);
    setError(null);

    try {
      const resolvedList: ResolvedConflictItem[] = plan.conflicts.map((c) => ({
        documentId: c.documentId,
        action: resolutions[c.documentId] || 'overwrite',
        fields: c.incomingFields,
      }));

      const res = await window.api.commitImport({
        connectionId,
        collectionPath,
        newDocuments: plan.newDocuments,
        resolvedConflicts: resolvedList,
      });

      if (!res.success) {
        setError(res.error || 'Import commit failed.');
      } else {
        setCommitResult({
          committed: res.committed,
          skipped: res.skipped,
          batchCount: res.batchCount,
        });
        onSuccess();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Import Documents (Two-Step Pre-Commit)
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">{collectionPath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Step 1: File Selection */}
          {!plan && !commitResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4 space-y-3">
                <span className="block font-semibold text-gray-200">
                  Select Import File (JSON or CSV)
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Fired will first dry-run the file without making any writes, checking for existing
                  document ID conflicts and schema type mismatches.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={filePath}
                    placeholder="Click Browse to select .json or .csv file..."
                    className="flex-1 rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    className="rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Browse...
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Plan / Review Screen */}
          {plan && !commitResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">Total Rows</div>
                  <div className="text-base font-bold text-white mt-0.5">{plan.totalIncoming}</div>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400">New Docs</div>
                  <div className="text-base font-bold text-emerald-300 mt-0.5">{plan.newCount}</div>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400">Conflicts</div>
                  <div className="text-base font-bold text-amber-300 mt-0.5">{plan.conflictCount}</div>
                </div>
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-400">Warnings</div>
                  <div className="text-base font-bold text-indigo-300 mt-0.5">{plan.schemaWarnings.length}</div>
                </div>
              </div>

              {/* Schema Warnings Section */}
              {plan.schemaWarnings.length > 0 && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                  <button
                    type="button"
                    onClick={() => setShowWarnings(!showWarnings)}
                    className="flex w-full items-center justify-between font-semibold text-indigo-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-indigo-400" />
                      <span>{plan.schemaWarnings.length} Schema Type Warnings (Informational)</span>
                    </div>
                    {showWarnings ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>

                  {showWarnings && (
                    <div className="mt-2.5 max-h-32 overflow-y-auto space-y-1.5 border-t border-indigo-500/20 pt-2">
                      {plan.schemaWarnings.map((w, idx) => (
                        <div key={idx} className="text-[11px] text-indigo-200/90 font-mono">
                          • {w.message} <span className="text-gray-400">(Doc: {w.documentId})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conflicts Section */}
              {plan.conflictCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-200">
                      Resolve ID Conflicts ({plan.conflictCount})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetAllResolutions('overwrite')}
                        className="rounded bg-[#21262d] hover:bg-[#30363d] px-2 py-0.5 text-[11px] text-amber-300 border border-[#363b42] cursor-pointer"
                      >
                        Overwrite All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllResolutions('skip')}
                        className="rounded bg-[#21262d] hover:bg-[#30363d] px-2 py-0.5 text-[11px] text-gray-300 border border-[#363b42] cursor-pointer"
                      >
                        Skip All
                      </button>
                    </div>
                  </div>

                  {/* Conflict list */}
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-[#30363d] bg-[#0d1117] divide-y divide-[#21262d]">
                    {plan.conflicts.map((conflict) => {
                      const isExpanded = expandedConflictId === conflict.documentId;
                      const allKeys = Array.from(
                        new Set([
                          ...Object.keys(conflict.existingFields),
                          ...Object.keys(conflict.incomingFields),
                        ])
                      ).sort();

                      return (
                        <div key={conflict.documentId} className="p-2.5">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedConflictId(isExpanded ? null : conflict.documentId)
                              }
                              className="flex items-center gap-1.5 font-mono text-xs text-amber-300 font-medium hover:underline cursor-pointer truncate max-w-sm"
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <span className="truncate">{conflict.documentId}</span>
                            </button>

                            {/* Overwrite vs Skip radio */}
                            <div className="flex items-center gap-3">
                              <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer text-amber-400">
                                <input
                                  type="radio"
                                  name={`res-${conflict.documentId}`}
                                  checked={resolutions[conflict.documentId] === 'overwrite'}
                                  onChange={() =>
                                    setResolutions((prev) => ({
                                      ...prev,
                                      [conflict.documentId]: 'overwrite',
                                    }))
                                  }
                                  className="text-amber-500 focus:ring-amber-500"
                                />
                                <span>Overwrite</span>
                              </label>

                              <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer text-gray-400">
                                <input
                                  type="radio"
                                  name={`res-${conflict.documentId}`}
                                  checked={resolutions[conflict.documentId] === 'skip'}
                                  onChange={() =>
                                    setResolutions((prev) => ({
                                      ...prev,
                                      [conflict.documentId]: 'skip',
                                    }))
                                  }
                                  className="text-amber-500 focus:ring-amber-500"
                                />
                                <span>Skip</span>
                              </label>
                            </div>
                          </div>

                          {/* Diff Table if expanded */}
                          {isExpanded && (
                            <div className="mt-2.5 rounded border border-[#30363d] overflow-hidden text-[11px]">
                              <table className="w-full text-left">
                                <thead className="bg-[#161b22] text-gray-400 font-semibold border-b border-[#30363d]">
                                  <tr>
                                    <th className="p-1.5">Field</th>
                                    <th className="p-1.5 text-rose-300">Existing Value</th>
                                    <th className="p-1.5 text-emerald-300">Incoming Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#21262d] font-mono">
                                  {allKeys.map((k) => (
                                    <tr key={k}>
                                      <td className="p-1.5 text-gray-300">{k}</td>
                                      <td className="p-1.5 text-rose-300/90 truncate max-w-xs">
                                        {renderFieldVal(conflict.existingFields[k])}
                                      </td>
                                      <td className="p-1.5 text-emerald-300/90 truncate max-w-xs">
                                        {renderFieldVal(conflict.incomingFields[k])}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No ID conflicts detected. All incoming documents are new!</span>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Finished Report */}
          {commitResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Import Committed Successfully!</h4>
              <p className="text-xs text-emerald-200">
                Wrote <span className="font-bold">{commitResult.committed} documents</span> across{' '}
                <span className="font-bold">{commitResult.batchCount} batch writes</span> (500 limit).{' '}
                {commitResult.skipped > 0 && `Skipped ${commitResult.skipped} conflicting documents.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <span className="text-[11px] text-gray-500">
            {!plan ? 'Step 1: Analyze file' : !commitResult ? 'Step 2: Review & Commit' : 'Complete'}
          </span>

          <div className="flex items-center gap-2">
            {!commitResult ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {!plan ? (
                  <button
                    type="button"
                    disabled={!filePath || planning}
                    onClick={handleRunPlan}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
                  >
                    {planning ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing file...</span>
                      </>
                    ) : (
                      <>
                        <span>Dry-Run Plan</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={committing}
                    onClick={handleCommit}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
                  >
                    {committing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Committing batches...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Commit Import</span>
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
