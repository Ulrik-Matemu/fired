import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  Plus,
  Trash2,
  ArrowUpDown,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
  ShieldAlert,
} from 'lucide-react';
import { WhereClause, WhereOperator, OrderByClause, SavedQuery } from '@shared/ipc-types';
import { SerializedFieldValue } from '@shared/firestore-types';
import { validateFirestoreQuery } from '../../lib/queryValidator';

interface QueryBuilderProps {
  collectionPath?: string;
  availableFields: string[];
  onApply: (where: WhereClause[], orderBy: OrderByClause[]) => void;
  isIndexError?: boolean;
  indexUrl?: string;
  errorMessage?: string;
}

interface FilterRowState {
  id: string;
  field: string;
  operator: WhereOperator;
  valueType: 'string' | 'number' | 'boolean' | 'null';
  valueText: string;
}

const OPERATORS: { value: WhereOperator; label: string }[] = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: 'array-contains', label: 'array-contains' },
  { value: 'in', label: 'in' },
  { value: 'array-contains-any', label: 'array-contains-any' },
  { value: 'not-in', label: 'not-in' },
];

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  collectionPath,
  availableFields,
  onApply,
  isIndexError,
  indexUrl,
  errorMessage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<FilterRowState[]>([]);
  const [orderField, setOrderField] = useState('');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');

  // Saved queries state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [activeSavedQuery, setActiveSavedQuery] = useState<SavedQuery | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newQueryName, setNewQueryName] = useState('');
  const [savingQuery, setSavingQuery] = useState(false);

  // Load saved queries
  const loadSavedQueries = async () => {
    try {
      const list = await window.api.listSavedQueries(collectionPath);
      setSavedQueries(list);
    } catch (e) {
      console.error('Failed to load saved queries:', e);
    }
  };

  useEffect(() => {
    loadSavedQueries();
  }, [collectionPath]);

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        field: availableFields[0] || '',
        operator: '==',
        valueType: 'string',
        valueText: '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, updates: Partial<FilterRowState>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const buildClauses = () => {
    const whereClauses: WhereClause[] = [];
    for (const r of rows) {
      if (!r.field.trim()) continue;

      let val: SerializedFieldValue;
      if (r.valueType === 'number') {
        const num = Number(r.valueText);
        val = { __type: 'number', value: isNaN(num) ? 0 : num };
      } else if (r.valueType === 'boolean') {
        val = { __type: 'boolean', value: r.valueText === 'true' };
      } else if (r.valueType === 'null') {
        val = { __type: 'null', value: null };
      } else {
        val = { __type: 'string', value: r.valueText };
      }

      whereClauses.push({
        field: r.field.trim(),
        operator: r.operator,
        value: val,
      });
    }

    const orderByClauses: OrderByClause[] = [];
    if (orderField.trim()) {
      orderByClauses.push({
        field: orderField.trim(),
        direction: orderDirection,
      });
    }

    return { whereClauses, orderByClauses };
  };

  // Real-time client-side pre-execution validation
  const validation = useMemo(() => {
    const { whereClauses, orderByClauses } = buildClauses();
    return validateFirestoreQuery(whereClauses, orderByClauses);
  }, [rows, orderField, orderDirection]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validation.isValid) return;

    const { whereClauses, orderByClauses } = buildClauses();
    onApply(whereClauses, orderByClauses);
  };

  const handleReset = () => {
    setRows([]);
    setOrderField('');
    setOrderDirection('asc');
    setActiveSavedQuery(null);
    onApply([], []);
  };

  const handleSaveCurrentQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryName.trim() || !validation.isValid) return;

    setSavingQuery(true);
    try {
      const { whereClauses, orderByClauses } = buildClauses();
      await window.api.saveQuery({
        name: newQueryName.trim(),
        collectionPath,
        where: whereClauses,
        orderBy: orderByClauses,
      });
      setNewQueryName('');
      setShowSaveDialog(false);
      await loadSavedQueries();
    } catch (err) {
      console.error('Failed to save query:', err);
    } finally {
      setSavingQuery(false);
    }
  };

  const handleSelectSavedQuery = (sq: SavedQuery) => {
    const newRows: FilterRowState[] = (sq.where || []).map((w) => {
      const valType: FilterRowState['valueType'] =
        w.value.__type === 'number'
          ? 'number'
          : w.value.__type === 'boolean'
          ? 'boolean'
          : w.value.__type === 'null'
          ? 'null'
          : 'string';

      const valText =
        w.value.__type === 'null'
          ? ''
          : typeof w.value.value === 'object'
          ? JSON.stringify(w.value.value)
          : String(w.value.value ?? '');

      return {
        id: Math.random().toString(36).substring(7),
        field: w.field,
        operator: w.operator,
        valueType: valType,
        valueText: valText,
      };
    });

    setRows(newRows);

    if (sq.orderBy && sq.orderBy.length > 0) {
      setOrderField(sq.orderBy[0].field);
      setOrderDirection(sq.orderBy[0].direction);
    } else {
      setOrderField('');
      setOrderDirection('asc');
    }

    setActiveSavedQuery(sq);
    onApply(sq.where || [], sq.orderBy || []);
    setIsOpen(true);
  };

  const handleDeleteSavedQuery = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.api.deleteSavedQuery(id);
    if (activeSavedQuery?.id === id) {
      setActiveSavedQuery(null);
    }
    await loadSavedQueries();
  };

  const activeFilterCount = rows.filter((r) => r.field.trim()).length + (orderField.trim() ? 1 : 0);

  return (
    <div className="border-b border-[#30363d] bg-[#161b22] text-xs">
      {/* Toggle Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <Filter className={`h-3.5 w-3.5 ${activeFilterCount > 0 ? 'text-amber-400' : 'text-gray-400'}`} />
            <span>Filters & Sort</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-amber-500/20 text-amber-400 px-1.5 py-0.2 text-[10px] font-bold border border-amber-500/30">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Saved Queries Dropdown & Active Indicator */}
          {savedQueries.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] ml-2 border-l border-[#30363d] pl-2">
              <Bookmark className="h-3 w-3 text-amber-400" />
              <select
                value={activeSavedQuery?.id || ''}
                onChange={(e) => {
                  const q = savedQueries.find((s) => s.id === e.target.value);
                  if (q) {
                    handleSelectSavedQuery(q);
                  }
                }}
                className="bg-transparent text-gray-300 hover:text-white cursor-pointer focus:outline-none"
              >
                <option value="" disabled>
                  Saved Queries ({savedQueries.length})
                </option>
                {savedQueries.map((q) => (
                  <option key={q.id} value={q.id} className="bg-[#161b22] text-gray-200">
                    {q.name}
                  </option>
                ))}
              </select>

              {activeSavedQuery && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteSavedQuery(activeSavedQuery.id, e)}
                  className="p-0.5 text-gray-400 hover:text-rose-400 transition-colors"
                  title={`Delete saved query "${activeSavedQuery.name}"`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                disabled={!validation.isValid}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Save current query locally"
              >
                <BookmarkCheck className="h-3 w-3" />
                <span>Save Query</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Client-Side Pre-Execution Validation Warning Banner */}
      {!validation.isValid && validation.error && (
        <div className="m-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="font-semibold text-white">Invalid Compound Query (Pre-Execution Validation)</span>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">{validation.error}</p>
          </div>
        </div>
      )}

      {/* Save Query Modal Dialog */}
      {showSaveDialog && (
        <div className="p-3 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between gap-3 animate-in fade-in">
          <form onSubmit={handleSaveCurrentQuery} className="flex flex-1 items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-300">Name query:</span>
            <input
              type="text"
              autoFocus
              value={newQueryName}
              onChange={(e) => setNewQueryName(e.target.value)}
              placeholder="e.g. Active High-Value Accounts"
              className="flex-1 max-w-sm rounded border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-xs text-gray-200 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newQueryName.trim() || savingQuery || !validation.isValid}
              className="rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-white cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Composite Index Error Banner */}
      {isIndexError && (
        <div className="m-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <p className="font-semibold text-white">This query requires a Firestore Composite Index</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Compound queries with multiple equality/inequality filters or order clauses require an
                index to execute. Click the link below to generate it instantly in your Firebase Console.
              </p>
              {indexUrl ? (
                <button
                  type="button"
                  onClick={() => window.api.openExternalUrl(indexUrl)}
                  className="inline-flex items-center gap-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 text-xs font-semibold shadow transition-colors cursor-pointer"
                >
                  <span>Create Index in Firebase Console</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              ) : (
                <p className="font-mono text-[10px] text-gray-400 break-all">{errorMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Filter Panel */}
      {isOpen && (
        <form onSubmit={handleApply} className="p-3 space-y-3 bg-[#0d1117]/60">
          {/* Where Clauses List */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Where Clauses
            </div>

            {rows.length === 0 ? (
              <p className="text-[11px] text-gray-500 italic">No filters added. Click "Add Filter" below.</p>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  {/* Field Name */}
                  <input
                    type="text"
                    list={`fields-list-${row.id}`}
                    value={row.field}
                    onChange={(e) => handleUpdateRow(row.id, { field: e.target.value })}
                    placeholder="Field name"
                    className="w-40 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />
                  <datalist id={`fields-list-${row.id}`}>
                    {availableFields.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>

                  {/* Operator */}
                  <select
                    value={row.operator}
                    onChange={(e) => handleUpdateRow(row.id, { operator: e.target.value as WhereOperator })}
                    className="w-28 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* Value Type Selector */}
                  <select
                    value={row.valueType}
                    onChange={(e) =>
                      handleUpdateRow(row.id, {
                        valueType: e.target.value as FilterRowState['valueType'],
                        valueText: e.target.value === 'boolean' ? 'true' : '',
                      })
                    }
                    className="w-24 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-400 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                  </select>

                  {/* Adaptive Value Input */}
                  {row.valueType === 'boolean' ? (
                    <select
                      value={row.valueText}
                      onChange={(e) => handleUpdateRow(row.id, { valueText: e.target.value })}
                      className="w-32 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : row.valueType === 'null' ? (
                    <div className="w-32 text-gray-500 italic px-2 py-1 select-none">null</div>
                  ) : (
                    <input
                      type={row.valueType === 'number' ? 'number' : 'text'}
                      value={row.valueText}
                      onChange={(e) => handleUpdateRow(row.id, { valueText: e.target.value })}
                      placeholder="Value"
                      className="flex-1 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  )}

                  {/* Remove Row */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#21262d] rounded cursor-pointer"
                    title="Remove filter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer pt-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add Filter</span>
            </button>
          </div>

          {/* Sort Control */}
          <div className="pt-2 border-t border-[#21262d]">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Order By
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                list="sort-fields-list"
                value={orderField}
                onChange={(e) => setOrderField(e.target.value)}
                placeholder="Sort field (optional)"
                className="w-48 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
              <datalist id="sort-fields-list">
                {availableFields.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>

              <button
                type="button"
                onClick={() => setOrderDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex items-center gap-1 rounded border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-xs text-gray-300 hover:text-white cursor-pointer"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>{orderDirection.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#21262d]">
            <button
              type="button"
              onClick={handleReset}
              className="rounded px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#21262d] cursor-pointer"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={!validation.isValid}
              className="rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
            >
              Apply Query
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
