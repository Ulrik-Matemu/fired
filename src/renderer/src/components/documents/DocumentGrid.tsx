import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowSelectionState,
} from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SerializedDocument,
  SerializedFieldValue,
  SerializedCursorValues,
} from '@shared/firestore-types';
import { WhereClause, OrderByClause, QueryDocumentsResponse } from '@shared/ipc-types';
import { generateColumns } from '../../lib/columns';
import { NestedJsonDialog } from './NestedJsonDialog';
import { CreateDocumentDialog } from './CreateDocumentDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { BatchDeleteDialog } from './BatchDeleteDialog';
import { ExportDialog } from './ExportDialog';
import { ImportWizardDialog } from '../import/ImportWizardDialog';
import { SubcollectionDrawer } from './SubcollectionDrawer';
import { ScriptRunnerDialog } from '../script/ScriptRunnerDialog';
import { BackupRestoreDialog } from '../backup/BackupRestoreDialog';
import { QueryBuilder } from '../query/QueryBuilder';
import { useAppStore } from '../../store';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Table as TableIcon,
  AlertCircle,
  Plus,
  Download,
  Upload,
  Trash2,
  CheckSquare,
  X,
  Lock,
  ChevronRight as ChevronBreadcrumb,
  Layers,
  Radio,
  Terminal,
  Archive,
} from 'lucide-react';

interface DocumentGridProps {
  connectionId: string;
  collectionPath: string;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
  connectionId,
  collectionPath,
}) => {
  const queryClient = useQueryClient();
  const { connections, setActiveCollectionPath } = useAppStore();

  // Find active connection info and read-only status
  const connection = connections.find((c) => c.id === connectionId);
  const isReadOnly = !!connection?.readOnly;

  const [pageSize, setPageSize] = useState<number>(50);
  const [cursorStack, setCursorStack] = useState<(SerializedCursorValues | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Filter & Sort state
  const [whereClauses, setWhereClauses] = useState<WhereClause[]>([]);
  const [orderByClauses, setOrderByClauses] = useState<OrderByClause[]>([]);

  // Real-time onSnapshot Live Mode state
  const [isLive, setIsLive] = useState(false);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [duplicateDoc, setDuplicateDoc] = useState<SerializedDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<SerializedDocument | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [subcolDoc, setSubcolDoc] = useState<SerializedDocument | null>(null);
  const [scriptRunnerOpen, setScriptRunnerOpen] = useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);

  // Nested field editor modal state
  const [nestedEditorState, setNestedEditorState] = useState<{
    isOpen: boolean;
    docPath: string;
    fieldPath: string;
    value: SerializedFieldValue | null;
  }>({
    isOpen: false,
    docPath: '',
    fieldPath: '',
    value: null,
  });

  const currentCursor = cursorStack[pageIndex] || undefined;
  const queryKey = [
    'documents',
    connectionId,
    collectionPath,
    currentCursor,
    pageSize,
    whereClauses,
    orderByClauses,
  ];

  // Reset pagination & selection if collection, connection, or filters change
  useEffect(() => {
    setCursorStack([null]);
    setPageIndex(0);
    setRowSelection({});
  }, [connectionId, collectionPath, pageSize, whereClauses, orderByClauses]);

  // Query documents with compound filters & cursor
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      return window.api.queryDocuments({
        connectionId,
        collectionPath,
        limit: pageSize,
        startAfterCursor: currentCursor,
        where: whereClauses.length > 0 ? whereClauses : undefined,
        orderBy: orderByClauses.length > 0 ? orderByClauses : undefined,
      });
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const documents = useMemo(() => data?.documents || [], [data?.documents]);
  const nextCursor = data?.nextCursor || null;
  const isIndexError = data?.isIndexError || false;
  const indexUrl = data?.indexUrl;
  const errorMessage = data?.errorMessage || (error ? (error as Error).message : undefined);

  // Real-Time onSnapshot subscriber
  useEffect(() => {
    if (!isLive) return;

    window.api.subscribeLive({
      connectionId,
      collectionPath,
      limit: pageSize,
      where: whereClauses.length > 0 ? whereClauses : undefined,
      orderBy: orderByClauses.length > 0 ? orderByClauses : undefined,
    });

    const cleanupListener = window.api.onLiveUpdate((event) => {
      if (event.connectionId === connectionId && event.collectionPath === collectionPath) {
        queryClient.setQueryData(queryKey, (old: QueryDocumentsResponse | undefined) => {
          return {
            ...(old || { nextCursor: null }),
            documents: event.documents,
          };
        });
      }
    });

    return () => {
      cleanupListener();
      window.api.unsubscribeLive(collectionPath);
    };
  }, [isLive, connectionId, collectionPath, pageSize, whereClauses, orderByClauses]);

  // Global keyboard shortcuts within DocumentGrid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        e.preventDefault();
        refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refetch]);

  // Collect available field names for autocomplete in QueryBuilder
  const availableFields = useMemo(() => {
    const s = new Set<string>();
    for (const doc of documents) {
      for (const k of Object.keys(doc.fields)) {
        s.add(k);
      }
    }
    return Array.from(s).sort();
  }, [documents]);

  // Update field handler (blocked if read-only)
  const handleUpdateField = async (
    docPath: string,
    fieldPath: string,
    value: SerializedFieldValue
  ) => {
    if (isReadOnly) return;
    await window.api.updateField({
      connectionId,
      documentPath: docPath,
      fieldPath,
      value,
    });
    await queryClient.invalidateQueries({
      queryKey: ['documents', connectionId, collectionPath],
    });
  };

  const handleOpenNestedEditor = (
    docPath: string,
    fieldPath: string,
    value: SerializedFieldValue
  ) => {
    setNestedEditorState({
      isOpen: true,
      docPath,
      fieldPath,
      value,
    });
  };

  const handleDuplicate = (doc: SerializedDocument) => {
    if (isReadOnly) return;
    setDuplicateDoc(doc);
    setCreateDialogOpen(true);
  };

  const handleDelete = (doc: SerializedDocument) => {
    if (isReadOnly) return;
    setDeleteDoc(doc);
  };

  // Generate dynamic columns with selection, actions, and subcollection explore
  const columns = useMemo(() => {
    return generateColumns(documents, {
      readOnly: isReadOnly,
      onUpdateField: handleUpdateField,
      onOpenNestedEditor: handleOpenNestedEditor,
      onDuplicate: handleDuplicate,
      onDelete: handleDelete,
      onToggleSubcollections: (doc) => setSubcolDoc(doc),
    });
  }, [documents, isReadOnly]);

  const table = useReactTable({
    data: documents,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  // Selected documents list
  const selectedDocuments = useMemo(() => {
    const selectedIndices = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    return selectedIndices.map((idx) => documents[Number(idx)]).filter(Boolean);
  }, [rowSelection, documents]);

  // Pagination navigation
  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => {
      const nextStack = prev.slice(0, pageIndex + 1);
      nextStack.push(nextCursor);
      return nextStack;
    });
    setPageIndex((prev) => prev + 1);
    setRowSelection({});
  };

  const handlePrevPage = () => {
    if (pageIndex <= 0) return;
    setPageIndex((prev) => prev - 1);
    setRowSelection({});
  };

  // Build hierarchical breadcrumb segments
  const breadcrumbSegments = useMemo(() => {
    const parts = collectionPath.split('/').filter(Boolean);
    const segments: { label: string; path: string; isCollection: boolean }[] = [];
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isCollection = i % 2 === 0; // Even indices are collections, odd indices are doc IDs
      segments.push({
        label: part,
        path: currentPath,
        isCollection,
      });
    }

    return segments;
  }, [collectionPath]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0d1117]">
      {/* Breadcrumb Path Navigation Header */}
      <div className="flex items-center justify-between border-b border-[#21262d] bg-[#161b22]/90 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto text-gray-400">
          <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold select-none">
            Path:
          </span>

          {breadcrumbSegments.map((segment, idx) => {
            const isLast = idx === breadcrumbSegments.length - 1;

            if (segment.isCollection) {
              return (
                <React.Fragment key={segment.path}>
                  {idx > 0 && <ChevronBreadcrumb className="h-3 w-3 text-gray-600 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => setActiveCollectionPath(segment.path)}
                    className={`font-medium hover:underline cursor-pointer truncate ${
                      isLast ? 'text-amber-300 font-bold' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {segment.label}
                  </button>
                </React.Fragment>
              );
            } else {
              return (
                <React.Fragment key={segment.path}>
                  <ChevronBreadcrumb className="h-3 w-3 text-gray-600 shrink-0" />
                  <span className="font-mono text-[11px] text-gray-400 truncate max-w-xs" title={segment.label}>
                    {segment.label}
                  </span>
                </React.Fragment>
              );
            }
          })}
        </div>

        {/* Read-Only Mode Badge */}
        {isReadOnly && (
          <div
            title="Read-Only Mode: All write operations (add, edit, delete, import) are locked"
            className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-400 shrink-0"
          >
            <Lock className="h-3 w-3" />
            <span>READ-ONLY MODE</span>
          </div>
        )}
      </div>

      {/* Query Builder & Composite Index Banner */}
      <QueryBuilder
        collectionPath={collectionPath}
        availableFields={availableFields}
        onApply={(where, order) => {
          setWhereClauses(where);
          setOrderByClauses(order);
        }}
        isIndexError={isIndexError}
        indexUrl={indexUrl}
        errorMessage={errorMessage}
      />

      {/* Grid Toolbar */}
      <div className="flex h-11 items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
            <TableIcon className="h-3.5 w-3.5 text-amber-400" />
            <span>Documents</span>
            <span className="text-[11px] text-gray-500 font-normal">
              ({documents.length} loaded)
            </span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 rounded bg-[#21262d] hover:bg-[#30363d] px-2 py-1 text-xs text-gray-300 transition-colors cursor-pointer border border-[#363b42]"
            title="Refresh documents (Ctrl+R)"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Real-time onSnapshot Live Toggle */}
          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold cursor-pointer border transition-colors ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                : 'bg-[#21262d] text-gray-400 border-[#363b42] hover:text-white'
            }`}
            title={isLive ? 'Live mode streaming updates from Firestore' : 'Click to enable real-time updates'}
          >
            <Radio className={`h-3 w-3 ${isLive ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>{isLive ? 'LIVE' : 'Live'}</span>
          </button>
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Script Runner Shell Button */}
          <button
            type="button"
            onClick={() => setScriptRunnerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
            title="Open JavaScript / Node Script Shell (Ctrl+Shift+S)"
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Script</span>
          </button>

          {/* Database Backup & Restore Button */}
          <button
            type="button"
            onClick={() => setBackupRestoreOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-2.5 py-1 text-xs font-medium text-indigo-300 transition-colors cursor-pointer"
            title="Backup & Restore Database (Ctrl+Shift+B)"
          >
            <Archive className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden lg:inline">Backup</span>
          </button>

          <div className="h-4 w-[1px] bg-[#30363d] mx-0.5" />

          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDuplicateDoc(null);
                  setCreateDialogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer"
                title="Create New Document"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden md:inline">New Document</span>
              </button>

              <button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] px-2.5 py-1 text-xs font-medium text-gray-200 transition-colors cursor-pointer"
                title="Import JSON/CSV"
              >
                <Upload className="h-3 w-3 text-indigo-400" />
                <span className="hidden lg:inline">Import</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setExportSelectedOnly(false);
              setExportDialogOpen(true);
            }}
            disabled={documents.length === 0}
            className="inline-flex items-center gap-1.5 rounded border border-[#363b42] bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1 text-xs font-medium text-gray-200 transition-colors cursor-pointer"
            title="Export Collection (JSON/CSV)"
          >
            <Download className="h-3 w-3 text-amber-400" />
            <span className="hidden lg:inline">Export</span>
          </button>

          <div className="h-4 w-[1px] bg-[#30363d] mx-0.5" />

          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>Size:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded bg-[#0d1117] border border-[#30363d] px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar when >= 1 documents selected */}
      {selectedDocuments.length > 0 && (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-200 animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-white">
              {selectedDocuments.length} of {documents.length} selected
            </span>
            <span className="text-[11px] text-amber-300/70">
              (Scoped to current loaded page)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExportSelectedOnly(true);
                setExportDialogOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#363b42] px-2.5 py-1 text-xs text-gray-200 cursor-pointer"
            >
              <Download className="h-3 w-3 text-amber-400" />
              <span>Export Selected ({selectedDocuments.length})</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(true)}
                className="inline-flex items-center gap-1 rounded bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white shadow-xs cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete Selected ({selectedDocuments.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
              title="Deselect all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Grid Table Area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-gray-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            <span>Fetching documents from Firestore...</span>
          </div>
        ) : error && !isIndexError ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-rose-400 gap-2">
            <AlertCircle className="h-6 w-6" />
            <p className="font-semibold text-sm">Failed to load documents</p>
            <p className="font-mono text-gray-400 max-w-md break-words">
              {(error as Error).message}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 rounded bg-[#21262d] px-3 py-1 text-gray-200 border border-[#363b42] hover:bg-[#30363d]"
            >
              Retry
            </button>
          </div>
        ) : isIndexError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-gray-400">
            <span>Please create the composite index shown above to view results for this query.</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-xs text-gray-500 gap-2">
            <TableIcon className="h-8 w-8 text-gray-600" />
            <span>No documents match the current criteria.</span>
            {!isReadOnly && (
              <button
                onClick={() => {
                  setDuplicateDoc(null);
                  setCreateDialogOpen(true);
                }}
                className="mt-1 inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create first document</span>
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#161b22] border-b border-[#30363d] select-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative px-3 py-2 text-xs font-semibold text-gray-300 border-r border-[#30363d] last:border-r-0 whitespace-nowrap bg-[#161b22]"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}

                      {/* Resize Handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-amber-500 ${
                            header.column.getIsResizing() ? 'bg-amber-500' : ''
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#161b22]/70 transition-colors group ${
                    row.getIsSelected() ? 'bg-amber-500/10' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-3 py-1.5 border-r border-[#21262d] last:border-r-0 whitespace-nowrap overflow-hidden max-w-xs"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <footer className="flex h-10 items-center justify-between border-t border-[#30363d] bg-[#161b22] px-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span>Page {pageIndex + 1}</span>
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Updating...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={pageIndex === 0 || isFetching}
            className="inline-flex items-center gap-1 rounded bg-[#21262d] hover:bg-[#30363d] px-2.5 py-1 text-xs text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed border border-[#363b42] transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!nextCursor || isFetching}
            className="inline-flex items-center gap-1 rounded bg-[#21262d] hover:bg-[#30363d] px-2.5 py-1 text-xs text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed border border-[#363b42] transition-colors cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>

      {/* Nested JSON Editor Dialog */}
      {nestedEditorState.isOpen && nestedEditorState.value && (
        <NestedJsonDialog
          isOpen={nestedEditorState.isOpen}
          onClose={() =>
            setNestedEditorState({
              isOpen: false,
              docPath: '',
              fieldPath: '',
              value: null,
            })
          }
          fieldPath={nestedEditorState.fieldPath}
          initialValue={nestedEditorState.value}
          readOnly={isReadOnly}
          onSave={
            isReadOnly
              ? undefined
              : async (newVal) => {
                  await handleUpdateField(
                    nestedEditorState.docPath,
                    nestedEditorState.fieldPath,
                    newVal
                  );
                }
          }
        />
      )}

      {/* Create / Duplicate Document Dialog */}
      <CreateDocumentDialog
        isOpen={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setDuplicateDoc(null);
        }}
        connectionId={connectionId}
        collectionPath={collectionPath}
        sourceDoc={duplicateDoc}
        onSuccess={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['documents', connectionId, collectionPath],
          });
        }}
      />

      {/* Single Document Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        document={deleteDoc}
        connectionId={connectionId}
        onSuccess={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['documents', connectionId, collectionPath],
          });
        }}
      />

      {/* Batch Delete Confirmation Dialog */}
      <BatchDeleteDialog
        isOpen={batchDeleteOpen}
        onClose={() => setBatchDeleteOpen(false)}
        selectedDocs={selectedDocuments}
        connectionId={connectionId}
        onSuccess={async () => {
          setRowSelection({});
          await queryClient.invalidateQueries({
            queryKey: ['documents', connectionId, collectionPath],
          });
        }}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        connectionId={connectionId}
        collectionPath={collectionPath}
        currentDocuments={exportSelectedOnly ? selectedDocuments : documents}
        currentWhere={whereClauses}
        currentOrderBy={orderByClauses}
      />

      {/* Import Wizard Dialog */}
      <ImportWizardDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        connectionId={connectionId}
        collectionPath={collectionPath}
        onSuccess={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['documents', connectionId, collectionPath],
          });
        }}
      />

      {/* Subcollections Drawer */}
      <SubcollectionDrawer
        isOpen={!!subcolDoc}
        onClose={() => setSubcolDoc(null)}
        document={subcolDoc}
        connectionId={connectionId}
      />

      {/* Script Runner Shell Dialog */}
      <ScriptRunnerDialog
        isOpen={scriptRunnerOpen}
        onClose={() => setScriptRunnerOpen(false)}
        connectionId={connectionId}
        collectionPath={collectionPath}
      />

      {/* Database Backup & Restore Dialog */}
      <BackupRestoreDialog
        isOpen={backupRestoreOpen}
        onClose={() => setBackupRestoreOpen(false)}
        connectionId={connectionId}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};
