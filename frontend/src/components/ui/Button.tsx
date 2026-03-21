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
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 rounded-[9px] transition-all duration-150',
    ghost: 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-[9px] transition-all duration-150',
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
