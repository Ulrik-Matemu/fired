import React, { useEffect, useState } from 'react';
import { X, Layers, Loader2, ArrowRight, FolderPlus } from 'lucide-react';
import { SerializedDocument } from '@shared/firestore-types';
import { useAppStore } from '../../store';

interface SubcollectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  document: SerializedDocument | null;
  connectionId: string;
}

export const SubcollectionDrawer: React.FC<SubcollectionDrawerProps> = ({
  isOpen,
  onClose,
  document,
  connectionId,
}) => {
  const { setActiveCollectionPath } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [subcollections, setSubcollections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New subcollection input
  const [showAddSubcol, setShowAddSubcol] = useState(false);
  const [newSubcolName, setNewSubcolName] = useState('');

  useEffect(() => {
    if (!isOpen || !document) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setShowAddSubcol(false);
    setNewSubcolName('');

    window.api
      .listSubcollections({
        connectionId,
        documentPath: document.__path,
      })
      .then((cols) => {
        if (isMounted) {
          setSubcollections(cols);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError((err as Error).message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, document, connectionId]);

  if (!isOpen || !document) return null;

  const handleNavigateToSubcollection = (subcolName: string) => {
    const fullPath = `${document.__path}/${subcolName}`;
    setActiveCollectionPath(fullPath);
    onClose();
  };

  const handleCreateSubcollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubcolName.trim()) return;
    const fullPath = `${document.__path}/${newSubcolName.trim()}`;
    setActiveCollectionPath(fullPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Subcollections</h3>
              <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs" title={document.__path}>
                {document.__path}
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

        {/* Content */}
        <div className="p-5 space-y-3 text-xs">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              <span>Scanning document subcollections...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-300">
              {error}
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Discovered Subcollections ({subcollections.length})
              </span>

              {subcollections.length === 0 ? (
                <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4 text-center text-gray-500 italic">
                  No subcollections found under this document.
                </div>
              ) : (
                <div className="divide-y divide-[#21262d] rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden max-h-52 overflow-y-auto">
                  {subcollections.map((subcol) => (
                    <div
                      key={subcol}
                      onClick={() => handleNavigateToSubcollection(subcol)}
                      className="group flex items-center justify-between p-2.5 hover:bg-[#161b22] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 text-gray-200">
                        <Layers className="h-3.5 w-3.5 text-amber-400" />
                        <span className="font-medium">{subcol}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Open Grid</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Subcollection path */}
              {!showAddSubcol ? (
                <button
                  type="button"
                  onClick={() => setShowAddSubcol(true)}
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium cursor-pointer pt-1"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Navigate to new/custom subcollection</span>
                </button>
              ) : (
                <form onSubmit={handleCreateSubcollection} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    autoFocus
                    value={newSubcolName}
                    onChange={(e) => setNewSubcolName(e.target.value)}
                    placeholder="Subcollection name (e.g. logs)"
                    className="flex-1 rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!newSubcolName.trim()}
                    className="rounded bg-amber-600 hover:bg-amber-500 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                  >
                    Go
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSubcol(false)}
                    className="text-gray-400 hover:text-white px-1.5 py-1"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
