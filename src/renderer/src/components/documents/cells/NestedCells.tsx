import React from 'react';
import { SerializedFieldValue } from '@shared/firestore-types';
import { FieldTypeBadge } from './FieldTypeBadge';
import { ExternalLink } from 'lucide-react';

interface NestedCellProps {
  value: SerializedFieldValue; // 'map' or 'array'
  onOpenEditor: () => void;
}

export const NestedCell: React.FC<NestedCellProps> = ({ value, onOpenEditor }) => {
  if (value.__type === 'map') {
    const keyCount = Object.keys(value.value).length;
    return (
      <div className="flex items-center gap-1.5 overflow-hidden">
        <FieldTypeBadge type="map" />
        <button
          type="button"
          onClick={onOpenEditor}
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-mono transition-colors cursor-pointer"
          title="Click to inspect/edit JSON"
        >
          <span>{`{${keyCount} keys}`}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100" />
        </button>
      </div>
    );
  }

  if (value.__type === 'array') {
    const itemCount = value.value.length;
    return (
      <div className="flex items-center gap-1.5 overflow-hidden">
        <FieldTypeBadge type="array" />
        <button
          type="button"
          onClick={onOpenEditor}
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 border border-teal-500/20 text-[11px] font-mono transition-colors cursor-pointer"
          title="Click to inspect/edit JSON"
        >
          <span>{`[${itemCount} items]`}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100" />
        </button>
      </div>
    );
  }

  return null;
};
