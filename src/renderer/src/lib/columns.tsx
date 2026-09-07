import { ColumnDef } from '@tanstack/react-table';
import { SerializedDocument, SerializedFieldValue } from '@shared/firestore-types';
import { ScalarCell } from '../components/documents/cells/ScalarCells';
import { NestedCell } from '../components/documents/cells/NestedCells';
import { Copy, Check, Hash, Trash2, Files, Layers, Lock } from 'lucide-react';
import { useState } from 'react';

interface ColumnOptions {
  readOnly?: boolean;
  onUpdateField: (docPath: string, fieldPath: string, value: SerializedFieldValue) => Promise<void>;
  onOpenNestedEditor: (docPath: string, fieldPath: string, value: SerializedFieldValue) => void;
  onDuplicate: (doc: SerializedDocument) => void;
  onDelete: (doc: SerializedDocument) => void;
  onToggleSubcollections?: (doc: SerializedDocument) => void;
}

const IdCell = ({
  doc,
  onToggleSubcollections,
}: {
  doc: SerializedDocument;
  onToggleSubcollections?: (doc: SerializedDocument) => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(doc.__id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-1 group font-mono text-xs text-amber-400/90 font-medium">
      <span className="truncate" title={doc.__id}>
        {doc.__id}
      </span>
      <div className="flex items-center gap-0.5">
        {onToggleSubcollections && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubcollections(doc);
            }}
            className="p-0.5 text-gray-400 hover:text-amber-400 rounded transition-colors cursor-pointer"
            title="Explore Subcollections"
          >
            <Layers className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-white rounded transition-opacity"
          title="Copy Document ID"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
};

export function generateColumns(
  documents: SerializedDocument[],
  { readOnly, onUpdateField, onOpenNestedEditor, onDuplicate, onDelete, onToggleSubcollections }: ColumnOptions
): ColumnDef<SerializedDocument>[] {
  // 1. Collect unique field keys across all loaded documents
  const allFieldKeys = new Set<string>();
  for (const doc of documents) {
    for (const key of Object.keys(doc.fields)) {
      allFieldKeys.add(key);
    }
  }

  const sortedFieldKeys = Array.from(allFieldKeys).sort();

  // 2. Build columns
  const columns: ColumnDef<SerializedDocument>[] = [
    // Selection Checkbox Column
    {
      id: '__select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-3.5 w-3.5 rounded border-[#30363d] bg-[#0d1117] text-amber-500 focus:ring-amber-500 cursor-pointer"
            title="Select all on current page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="h-3.5 w-3.5 rounded border-[#30363d] bg-[#0d1117] text-amber-500 focus:ring-amber-500 cursor-pointer"
          />
        </div>
      ),
      size: 40,
      enableResizing: false,
    },

    // Pinned ID Column
    {
      id: '__id',
      accessorKey: '__id',
      header: () => (
        <div className="flex items-center gap-1.5 font-semibold text-gray-300">
          <Hash className="h-3.5 w-3.5 text-amber-400" />
          <span>ID</span>
        </div>
      ),
      cell: ({ row }) => (
        <IdCell doc={row.original} onToggleSubcollections={onToggleSubcollections} />
      ),
      size: 200,
      enableResizing: true,
    },
  ];

  // Inferred Field Columns
  for (const fieldKey of sortedFieldKeys) {
    columns.push({
      id: fieldKey,
      header: () => (
        <div className="flex items-center gap-1.5 font-medium text-gray-300">
          <span className="truncate">{fieldKey}</span>
        </div>
      ),
      accessorFn: (row) => row.fields[fieldKey],
      cell: ({ row }) => {
        const fieldVal = row.original.fields[fieldKey];
        if (!fieldVal) {
          return <span className="text-gray-600 select-none text-xs">—</span>;
        }

        if (fieldVal.__type === 'map' || fieldVal.__type === 'array') {
          return (
            <NestedCell
              value={fieldVal}
              onOpenEditor={() =>
                onOpenNestedEditor(row.original.__path, fieldKey, fieldVal)
              }
            />
          );
        }

        return (
          <ScalarCell
            value={fieldVal}
            onSave={
              readOnly
                ? undefined
                : async (newVal) => {
                    await onUpdateField(row.original.__path, fieldKey, newVal);
                  }
            }
          />
        );
      },
      size: 180,
      enableResizing: true,
    });
  }

  // Row Actions Column
  columns.push({
    id: '__actions',
    header: () => <span className="text-gray-400">Actions</span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        {readOnly ? (
          <span
            title="Read-only mode: modifications disabled"
            className="p-1 text-gray-600 flex items-center gap-1 text-[11px]"
          >
            <Lock className="h-3 w-3" />
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(row.original);
              }}
              className="p-1 rounded text-gray-400 hover:text-amber-300 hover:bg-[#21262d] transition-colors cursor-pointer"
              title="Duplicate Document"
            >
              <Files className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.original);
              }}
              className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-[#21262d] transition-colors cursor-pointer"
              title="Delete Document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    ),
    size: 90,
    enableResizing: false,
  });

  return columns;
}
