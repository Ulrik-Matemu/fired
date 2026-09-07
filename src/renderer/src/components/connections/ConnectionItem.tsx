import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Flame,
  RefreshCw,
  Trash2,
  Loader2,
  AlertCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import { ConnectionInfo } from '@shared/ipc-types';
import { useAppStore } from '../../store';
import { CollectionTreeNode } from './CollectionTreeNode';

interface ConnectionItemProps {
  connection: ConnectionInfo;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({ connection }) => {
  const {
    activeConnectionId,
    connectionStatuses,
    connectionErrors,
    collectionsByConnection,
    expandedConnectionIds,
    setActiveConnectionId,
    setConnectionStatus,
    setCollections,
    toggleExpandConnection,
    removeConnection,
    updateConnectionReadOnly,
  } = useAppStore();

  const [loadingCollections, setLoadingCollections] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpanded = !!expandedConnectionIds[connection.id];
  const isActive = activeConnectionId === connection.id;
  const status = connectionStatuses[connection.id] || 'disconnected';
  const errorMsg = connectionErrors[connection.id];
  const collections = collectionsByConnection[connection.id] || [];
  const isReadOnly = !!connection.readOnly;

  const loadCollections = async () => {
    setLoadingCollections(true);
    setConnectionStatus(connection.id, 'connecting');
    try {
      const cols = await window.api.listCollections({ connectionId: connection.id });
      setCollections(connection.id, cols);
      setConnectionStatus(connection.id, 'connected');
    } catch (err) {
      setConnectionStatus(connection.id, 'error', (err as Error).message);
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleToggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConnectionId(connection.id);

    if (!isExpanded && status !== 'connected') {
      await loadCollections();
    }
    toggleExpandConnection(connection.id);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await loadCollections();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    try {
      await window.api.removeConnection(connection.id);
      removeConnection(connection.id);
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  const handleToggleReadOnly = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isReadOnly;
    try {
      await window.api.updateReadOnly({ connectionId: connection.id, readOnly: nextVal });
      updateConnectionReadOnly(connection.id, nextVal);
    } catch (err) {
      console.error('Failed to toggle read-only mode:', err);
    }
  };

  return (
    <div className="select-none text-xs">
      {/* Connection Header Row */}
      <div
        onClick={handleToggleExpand}
        className={`group flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
          isActive
            ? 'bg-[#21262d] text-white border-l-2 border-amber-500'
            : 'text-gray-300 hover:bg-[#161b22] hover:text-white'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-gray-400 p-0.5 hover:text-white">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>

          {/* Status Dot */}
          <span className="relative flex h-2 w-2 items-center justify-center">
            {status === 'connecting' ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />
            ) : status === 'connected' ? (
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
            ) : status === 'error' ? (
              <span
                className="h-2 w-2 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50"
                title={errorMsg || 'Connection error'}
              />
            ) : (
              <span className="h-2 w-2 rounded-full bg-gray-600" />
            )}
          </span>

          {/* Connection Name */}
          <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-0.5 fill-amber-400/20" />
          <div className="truncate flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-200 truncate">{connection.name}</span>
              {isReadOnly && (
                <span
                  title="Read-Only Mode: All write operations are strictly blocked"
                  className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[9.5px] font-semibold text-amber-400 flex items-center gap-0.5"
                >
                  <Lock className="h-2.5 w-2.5" />
                  RO
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-mono truncate">{connection.projectId}</span>
          </div>
        </div>

        {/* Action buttons (revealed on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Read-only Toggle Button */}
          <button
            onClick={handleToggleReadOnly}
            className={`p-1 rounded cursor-pointer transition-colors ${
              isReadOnly
                ? 'text-amber-400 hover:text-white hover:bg-amber-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#30363d]'
            }`}
            title={isReadOnly ? 'Click to disable Read-Only mode' : 'Click to enable Read-Only mode'}
          >
            {isReadOnly ? <Lock className="h-3 w-3 text-amber-400" /> : <Unlock className="h-3 w-3" />}
          </button>

          <button
            onClick={handleRefresh}
            disabled={loadingCollections}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#30363d] rounded cursor-pointer"
            title="Refresh Collections"
          >
            <RefreshCw className={`h-3 w-3 ${loadingCollections ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleDelete}
            className={`p-1 rounded cursor-pointer transition-colors ${
              confirmDelete
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'text-gray-400 hover:text-red-400 hover:bg-[#30363d]'
            }`}
            title={confirmDelete ? 'Click again to confirm delete' : 'Delete Connection'}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Error alert banner under connection if error */}
      {status === 'error' && isExpanded && errorMsg && (
        <div className="ml-6 mr-2 mt-1 rounded bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-300 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 break-words">
            <p className="font-medium">Failed to reach Firestore</p>
            <p className="text-[10px] opacity-80 mt-0.5">{errorMsg}</p>
            <button
              onClick={handleRefresh}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-rose-200 underline hover:text-white"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Collection Tree List with Recursive Subcollections */}
      {isExpanded && status !== 'error' && (
        <div className="ml-5 mt-0.5 border-l border-[#30363d] pl-2 space-y-0.5">
          {loadingCollections && collections.length === 0 ? (
            <div className="flex items-center gap-2 py-1 px-2 text-gray-500 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
              <span>Loading collections...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-1 px-2 text-gray-500 text-[11px] italic">
              No root collections found.
            </div>
          ) : (
            collections.map((col) => (
              <CollectionTreeNode
                key={col.path}
                connectionId={connection.id}
                collection={col}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
