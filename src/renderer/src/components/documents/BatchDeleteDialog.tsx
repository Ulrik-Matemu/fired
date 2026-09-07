import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { SerializedDocument } from '@shared/firestore-types';

interface BatchDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDocs: SerializedDocument[];
  connectionId: string;
  onSuccess: () => void;
}

export const BatchDeleteDialog: React.FC<BatchDeleteDialogProps> = ({
  isOpen,
  onClose,
  selectedDocs,
  connectionId,
  onSuccess,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || selectedDocs.length === 0) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const paths = selectedDocs.map((d) => d.__path);
      await window.api.batchDeleteDocs({
        connectionId,
        documentPaths: paths,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-rose-500/30 bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5 bg-rose-500/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Delete {selectedDocs.length} Documents
              </h3>
              <p className="text-[11px] text-rose-300/80">Permanent, non-reversible bulk action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-xs overflow-y-auto">
          <p className="text-gray-200 font-medium">
            Are you sure you want to permanently delete{' '}
            <span className="text-rose-400 font-bold">{selectedDocs.length} documents</span>?
          </p>

          <p className="text-[11px] text-rose-400/90 leading-relaxed">
            Firestore does not support soft deletes or undo. These documents will be deleted in batched operations of up to 500 writes.
          </p>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Selected Document IDs:
            </span>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#30363d] bg-[#0d1117] p-2 space-y-1 font-mono text-[11px] text-gray-400">
              {selectedDocs.map((doc) => (
                <div key={doc.__id} className="truncate text-amber-300/90">
                  {doc.__id}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting batch...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete {selectedDocs.length} Documents</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
