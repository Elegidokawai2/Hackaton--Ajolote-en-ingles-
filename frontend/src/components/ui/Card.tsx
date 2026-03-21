import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className, clickable = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'card p-6',
        clickable && 'card-clickable',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
