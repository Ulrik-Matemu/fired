import React, { useState, useEffect, useRef } from 'react';
import { SerializedFieldValue } from '@shared/firestore-types';
import { FieldTypeBadge } from './FieldTypeBadge';
import { Check, X } from 'lucide-react';

interface ScalarCellProps {
  value: SerializedFieldValue;
  onSave?: (val: SerializedFieldValue) => Promise<void>;
  disabled?: boolean;
}

export const ScalarCell: React.FC<ScalarCellProps> = ({ value, onSave, disabled }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize edit text based on value type
  useEffect(() => {
    if (value.__type === 'string') {
      setEditValue(value.value);
    } else if (value.__type === 'number') {
      setEditValue(String(value.value));
    } else if (value.__type === 'boolean') {
      setEditValue(String(value.value));
    } else if (value.__type === 'timestamp') {
      setEditValue(value.value.iso);
    } else if (value.__type === 'geopoint') {
      setEditValue(`${value.value.latitude}, ${value.value.longitude}`);
    } else if (value.__type === 'reference') {
      setEditValue(value.value.path);
    } else if (value.__type === 'null') {
      setEditValue('null');
    }
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleCommit = async () => {
    if (disabled || saving) return;

    let nextVal: SerializedFieldValue = value;

    if (value.__type === 'string') {
      nextVal = { __type: 'string', value: editValue };
    } else if (value.__type === 'number') {
      const num = Number(editValue);
      if (isNaN(num)) {
        setIsEditing(false);
        return;
      }
      nextVal = { __type: 'number', value: num };
    } else if (value.__type === 'boolean') {
      const lower = editValue.trim().toLowerCase();
      nextVal = { __type: 'boolean', value: lower === 'true' || lower === '1' };
    } else if (value.__type === 'timestamp') {
      const d = new Date(editValue);
      if (isNaN(d.getTime())) {
        setIsEditing(false);
        return;
      }
      nextVal = {
        __type: 'timestamp',
        value: {
          seconds: Math.floor(d.getTime() / 1000),
          nanoseconds: (d.getTime() % 1000) * 1000000,
          iso: d.toISOString(),
        },
      };
    } else if (value.__type === 'geopoint') {
      const parts = editValue.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
        setIsEditing(false);
        return;
      }
      nextVal = {
        __type: 'geopoint',
        value: { latitude: parts[0], longitude: parts[1] },
      };
    } else if (value.__type === 'reference') {
      const path = editValue.trim();
      const parts = path.split('/');
      nextVal = {
        __type: 'reference',
        value: {
          path,
          collectionId: parts.length > 1 ? parts[parts.length - 2] : '',
          documentId: parts[parts.length - 1] || '',
        },
      };
    } else if (value.__type === 'null') {
      // Keep null or string if changed
      if (editValue.trim() === 'null') {
        nextVal = { __type: 'null', value: null };
      } else {
        nextVal = { __type: 'string', value: editValue };
      }
    }

    setSaving(true);
    try {
      if (onSave) {
        await onSave(nextVal);
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update scalar field:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // 1. Boolean special quick-toggle on click
  if (value.__type === 'boolean' && !isEditing) {
    return (
      <div className="flex items-center gap-1.5 group cursor-pointer" onDoubleClick={() => !disabled && !!onSave && setIsEditing(true)}>
        <FieldTypeBadge type="boolean" />
        <button
          type="button"
          disabled={disabled || !onSave}
          onClick={async (e) => {
            e.stopPropagation();
            if (onSave) {
              await onSave({ __type: 'boolean', value: !value.value });
            }
          }}
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
            value.value
              ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
              : 'bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700/60'
          }`}
        >
          {String(value.value)}
        </button>
      </div>
    );
  }

  // 2. Active inline edit mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCommit}
          className="flex-1 bg-[#0d1117] border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none"
        />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleCommit();
          }}
          className="p-0.5 text-emerald-400 hover:text-white"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            setIsEditing(false);
          }}
          className="p-0.5 text-gray-500 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // 3. Display mode
  let displayNode: React.ReactNode;
  if (value.__type === 'string') {
    displayNode = <span className="truncate text-gray-200">{value.value}</span>;
  } else if (value.__type === 'number') {
    displayNode = <span className="font-mono text-blue-300">{value.value}</span>;
  } else if (value.__type === 'null') {
    displayNode = <span className="text-gray-500 italic font-mono">null</span>;
  } else if (value.__type === 'timestamp') {
    displayNode = (
      <span className="font-mono text-[11px] text-emerald-300 truncate" title={value.value.iso}>
        {value.value.iso.replace('T', ' ').replace('Z', '')}
      </span>
    );
  } else if (value.__type === 'geopoint') {
    displayNode = (
      <span className="font-mono text-[11px] text-orange-300">
        ({value.value.latitude.toFixed(4)}, {value.value.longitude.toFixed(4)})
      </span>
    );
  } else if (value.__type === 'reference') {
    displayNode = (
      <span className="font-mono text-[11px] text-sky-300 underline underline-offset-2 truncate" title={value.value.path}>
        {value.value.path}
      </span>
    );
  } else if (value.__type === 'bytes') {
    displayNode = <span className="font-mono text-[11px] text-zinc-400">[{value.value.length} bytes]</span>;
  }

  return (
    <div
      onDoubleClick={() => !disabled && !!onSave && setIsEditing(true)}
      title={!disabled && !!onSave ? "Double click to edit" : undefined}
      className={`flex items-center gap-1.5 max-w-full overflow-hidden px-1 py-0.5 rounded transition-colors ${
        !disabled && !!onSave ? 'cursor-text hover:bg-white/5' : 'cursor-default'
      }`}
    >
      <FieldTypeBadge type={value.__type} />
      <div className="truncate flex-1">{displayNode}</div>
    </div>
  );
};
