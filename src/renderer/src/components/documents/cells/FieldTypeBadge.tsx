import React from 'react';
import { FieldType } from '@shared/firestore-types';

interface FieldTypeBadgeProps {
  type: FieldType;
}

const BADGE_CONFIG: Record<FieldType, { label: string; bg: string; text: string; border: string }> = {
  string: { label: 'str', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  number: { label: 'num', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  boolean: { label: 'bool', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  null: { label: 'null', bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  timestamp: { label: 'time', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  geopoint: { label: 'geo', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  reference: { label: 'ref', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  bytes: { label: 'bytes', bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
  map: { label: 'map', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  array: { label: 'arr', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
};

export const FieldTypeBadge: React.FC<FieldTypeBadgeProps> = ({ type }) => {
  const cfg = BADGE_CONFIG[type] || BADGE_CONFIG.null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} select-none`}
    >
      {cfg.label}
    </span>
  );
};
