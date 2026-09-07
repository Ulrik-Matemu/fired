import React, { useState, useEffect } from 'react';
import { X, Code2, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { SerializedFieldValue } from '@shared/firestore-types';

interface NestedJsonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fieldPath: string;
  initialValue: SerializedFieldValue;
  onSave?: (val: SerializedFieldValue) => Promise<void>;
  readOnly?: boolean;
}

// Convert SerializedFieldValue to a plain JS value representation suitable for JSON stringify
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

// Convert plain JSON parse result back to SerializedFieldValue tree
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

    // Handle special tagged objects
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

export const NestedJsonDialog: React.FC<NestedJsonDialogProps> = ({
  isOpen,
  onClose,
  fieldPath,
  initialValue,
  onSave,
  readOnly,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const plain = serializedToPlain(initialValue);
        setJsonText(JSON.stringify(plain, null, 2));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [isOpen, initialValue]);

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

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      const serialized = plainToSerialized(parsed);

      setSaving(true);
      if (onSave) {
        await onSave(serialized);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Edit Field: <span className="font-mono text-amber-300">{fieldPath}</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Type: {initialValue.__type} (formatted as JSON)
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

        {/* Editor body */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-2">
          <textarea
            value={jsonText}
            readOnly={readOnly}
            onChange={(e) => !readOnly && handleTextChange(e.target.value)}
            className={`flex-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none resize-none min-h-[300px] ${
              readOnly ? 'cursor-default opacity-85' : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
            }`}
            spellCheck={false}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="font-mono text-[11px] truncate">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <span className="text-[11px] text-gray-500">
            {readOnly ? 'Viewing in Read-Only mode' : 'Valid JSON is required to save edits.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && onSave && (
              <button
                type="button"
                disabled={!!error || saving}
                onClick={handleSave}
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
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
