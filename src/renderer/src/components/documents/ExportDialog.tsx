import React, { useState } from 'react';
import { Download, X, FileJson, FileSpreadsheet, Check, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';
import { WhereClause, OrderByClause } from '@shared/ipc-types';
import { SerializedDocument } from '@shared/firestore-types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  collectionPath: string;
  currentDocuments: SerializedDocument[];
  currentWhere?: WhereClause[];
  currentOrderBy?: OrderByClause[];
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  collectionPath,
  currentDocuments,
  currentWhere,
  currentOrderBy,
}) => {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [filePath, setFilePath] = useState('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);

  if (!isOpen) return null;

  const handleChooseLocation = async () => {
    const ext = format;
    const defaultName = `${collectionPath.replace(/\//g, '_')}_export.${ext}`;
    const selected = await window.api.saveFileDialog({
      defaultPath: defaultName,
      filters: [
        {
          name: format === 'json' ? 'JSON File' : 'CSV Spreadsheet',
          extensions: [ext],
        },
      ],
    });
    if (selected) {
      setFilePath(selected);
      setResult(null);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath) {
      setResult({ success: false, count: 0, error: 'Please choose a destination file path.' });
      return;
    }

    setExporting(true);
    setResult(null);

    try {
      const sanitizedDocs =
        scope === 'current'
          ? JSON.parse(JSON.stringify(currentDocuments))
          : undefined;

      const res = await window.api.exportCollection({
        connectionId,
        collectionPath,
        filePath,
        format,
        scope,
        currentDocuments: sanitizedDocs,
        where: currentWhere,
        orderBy: currentOrderBy,
      });
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      setResult({ success: false, count: 0, error: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Export Collection Data</h3>
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

        {/* Form Body */}
        <form onSubmit={handleExport} className="p-5 space-y-4 text-xs">
          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormat('json');
                  if (filePath.endsWith('.csv')) setFilePath(filePath.replace(/\.csv$/, '.json'));
                }}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-all ${
                  format === 'json'
                    ? 'border-amber-500 bg-amber-500/10 text-white font-medium'
                    : 'border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-500'
                }`}
              >
                <FileJson className="h-4 w-4 text-amber-400" />
                <div className="text-left">
                  <div>JSON</div>
                  <div className="text-[10px] text-gray-500">Full structured object tree</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormat('csv');
                  if (filePath.endsWith('.json')) setFilePath(filePath.replace(/\.json$/, '.csv'));
                }}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-all ${
                  format === 'csv'
                    ? 'border-amber-500 bg-amber-500/10 text-white font-medium'
                    : 'border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-500'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <div className="text-left">
                  <div>CSV</div>
                  <div className="text-[10px] text-gray-500">Spreadsheet table</div>
                </div>
              </button>
            </div>
          </div>

          {/* CSV Disclaimer */}
          {format === 'csv' && (
            <div className="flex items-start gap-2 rounded-lg bg-zinc-800/40 border border-[#30363d] p-2.5 text-[11px] text-zinc-400">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span>
                CSV flattening: 1-level nested maps become dot-notation columns (e.g.{' '}
                <code className="text-gray-300">address.city</code>). Deeper nested maps and arrays are
                serialized as JSON strings in their cell.
              </span>
            </div>
          )}

          {/* Scope Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
              Export Scope
            </label>
            <div className="space-y-2 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="current"
                  checked={scope === 'current'}
                  onChange={() => setScope('current')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="text-gray-200 font-medium">Current Loaded Page</span>
                  <span className="text-[11px] text-gray-500 ml-1">({currentDocuments.length} documents)</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="text-gray-200 font-medium">All Matching Documents</span>
                  <span className="text-[11px] text-amber-400/80 ml-1">
                    (queries entire collection/filter)
                  </span>
                </div>
              </label>
            </div>
            {scope === 'all' && (
              <p className="text-[10px] text-amber-400/80 italic">
                Note: Exporting all documents iterates through Firestore and incurs standard document read costs.
              </p>
            )}
          </div>

          {/* Destination File */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
              Destination File
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={filePath}
                placeholder="Click Browse to select destination..."
                className="flex-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleChooseLocation}
                className="rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Status / Result Banner */}
          {result && (
            <div
              className={`rounded-lg border p-3 flex items-center gap-2 text-xs ${
                result.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {result.success ? (
                <>
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Successfully exported {result.count} documents to file!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="truncate">{result.error}</span>
                </>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={exporting || !filePath}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
