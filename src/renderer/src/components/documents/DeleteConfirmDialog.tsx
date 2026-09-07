import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { SerializedDocument } from '@shared/firestore-types';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: SerializedDocument | null;
  connectionId: string;
  onSuccess: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  document,
  connectionId,
  onSuccess,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await window.api.deleteDocument({
        connectionId,
        documentPath: document.__path,
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
      <div className="relative w-full max-w-md rounded-xl border border-rose-500/30 bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5 bg-rose-500/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Delete Document</h3>
              <p className="text-[11px] text-rose-300/80">Permanent, non-reversible action</p>
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
        <div className="p-5 space-y-3 text-xs">
          <p className="text-gray-300 leading-relaxed">
            Are you sure you want to permanently delete document{' '}
            <span className="font-mono font-bold text-amber-300">{document.__id}</span>?
          </p>

          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 font-mono text-[11px] text-gray-400 truncate">
            Path: {document.__path}
          </div>

          <p className="text-[11px] text-rose-400/90 leading-relaxed font-medium">
            Firestore does not support soft deletes or undo. This document will be immediately deleted from the database.
          </p>

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
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
