import React, { useState, useEffect } from 'react';
import { X, Plus, Copy, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { SerializedDocument, SerializedFieldValue } from '@shared/firestore-types';

interface CreateDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  collectionPath: string;
  sourceDoc?: SerializedDocument | null;
  onSuccess: () => void;
}

// Convert plain JSON parse result to SerializedFieldValue tree
function plainToSerialized(val: unknown): SerializedFieldValue {
  if (val === null || val === undefined) {
    return { __type: 'null', value: null };
  }
  if (typeof val === 'string') {
    return { __type: 'string', value: val };
  }
  if (typeof val === 'number') {
    return { __type: 'number', value: val };
  }
  if (typeof val === 'boolean') {
    return { __type: 'boolean', value: val };
  }
  if (Array.isArray(val)) {
    return { __type: 'array', value: val.map(plainToSerialized) };
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;

    // Special tagged objects
    if (obj._type === 'timestamp' && typeof obj.iso === 'string') {
      const d = new Date(obj.iso);
      return {
        __type: 'timestamp',
        value: {
          seconds: Math.floor(d.getTime() / 1000),
          nanoseconds: (d.getTime() % 1000) * 1000000,
          iso: d.toISOString(),
        },
      };
    }
    if (obj._type === 'geopoint' && typeof obj.latitude === 'number' && typeof obj.longitude === 'number') {
      return {
        __type: 'geopoint',
        value: { latitude: obj.latitude, longitude: obj.longitude },
      };
    }
    if (obj._type === 'reference' && typeof obj.path === 'string') {
      const parts = obj.path.split('/');
      return {
        __type: 'reference',
        value: {
          path: obj.path,
          collectionId: parts.length > 1 ? parts[parts.length - 2] : '',
          documentId: parts[parts.length - 1] || '',
        },
      };
    }

    const mapVal: Record<string, SerializedFieldValue> = {};
    for (const k of Object.keys(obj)) {
      mapVal[k] = plainToSerialized(obj[k]);
    }
    return { __type: 'map', value: mapVal };
  }
  return { __type: 'string', value: String(val) };
}

function serializedToPlain(val: SerializedFieldValue): unknown {
  switch (val.__type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return val.value;
    case 'timestamp':
      return { _type: 'timestamp', iso: val.value.iso };
    case 'geopoint':
      return { _type: 'geopoint', latitude: val.value.latitude, longitude: val.value.longitude };
    case 'reference':
      return { _type: 'reference', path: val.value.path };
    case 'bytes':
      return { _type: 'bytes', base64: val.value };
    case 'array':
      return val.value.map(serializedToPlain);
    case 'map': {
      const res: Record<string, unknown> = {};
      for (const k of Object.keys(val.value)) {
        res[k] = serializedToPlain(val.value[k]);
      }
      return res;
    }
  }
}

export const CreateDocumentDialog: React.FC<CreateDocumentDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  collectionPath,
  sourceDoc,
  onSuccess,
}) => {
  const [autoId, setAutoId] = useState(true);
  const [customId, setCustomId] = useState('');
  const [jsonText, setJsonText] = useState('{\n  \n}');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (sourceDoc) {
        // Duplication mode: extract fields
        const plainData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(sourceDoc.fields)) {
          plainData[k] = serializedToPlain(v);
        }
        setJsonText(JSON.stringify(plainData, null, 2));
        setAutoId(true);
        setCustomId('');
      } else {
        // Blank mode
        setJsonText('{\n  "name": "New Item",\n  "createdAt": "' + new Date().toISOString() + '"\n}');
        setAutoId(true);
        setCustomId('');
      }
      setError(null);
    }
  }, [isOpen, sourceDoc]);

  if (!isOpen) return null;

  const handleTextChange = (val: string) => {
    setJsonText(val);
    try {
      JSON.parse(val);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoId && !customId.trim()) {
      setError('Please provide a document ID or select Auto-generate.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Root document data must be a JSON object ({ ... }).');
      }

      const serializedFields: Record<string, SerializedFieldValue> = {};
      for (const [k, v] of Object.entries(parsed)) {
        serializedFields[k] = plainToSerialized(v);
      }

      setSaving(true);
      await window.api.createDocument({
        connectionId,
        collectionPath,
        documentId: autoId ? undefined : customId.trim(),
        data: serializedFields,
      });

      onSuccess();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {sourceDoc ? <Copy className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {sourceDoc ? 'Duplicate Document' : 'Create New Document'}
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Collection: {collectionPath}
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

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Document ID selection */}
          <div className="space-y-2 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300">Document ID</span>
              <label className="inline-flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white">
                <input
                  type="checkbox"
                  checked={autoId}
                  onChange={(e) => setAutoId(e.target.checked)}
                  className="rounded border-[#30363d] bg-[#161b22] text-amber-500 focus:ring-amber-500"
                />
                <span className="text-[11px]">Auto-generate ID</span>
              </label>
            </div>

            {!autoId && (
              <input
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="Enter custom document ID"
                className="w-full rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
              />
            )}
          </div>

          {/* JSON Document Fields */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-300">
              Document Data (JSON)
            </label>
            <textarea
              rows={10}
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none min-h-[220px]"
              spellCheck={false}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="font-mono text-[11px] truncate">{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!error || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Create Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
