'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base = 'btn font-medium cursor-pointer inline-flex items-center gap-1.5 select-none';

  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 rounded-[9px] transition-all duration-200',
    ghost: 'text-[color:var(--text-3)] hover:text-white hover:bg-white/[0.06] rounded-[9px] transition-all duration-200',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
