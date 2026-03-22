import React from 'react';
import { LucideIcon } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(33,133,213,0.07)', border: '1px solid rgba(33,133,213,0.14)' }}
      >
        <Icon className="w-6 h-6 text-[#2185D5] opacity-60" />
      </div>
      <h3 className="text-sm font-semibold text-white mt-1">{title}</h3>
      <p className="text-xs mt-1.5 max-w-xs" style={{ color: 'var(--text-3)' }}>{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button size="sm" onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
