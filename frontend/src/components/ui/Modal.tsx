'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-md relative rounded-2xl p-px"
        style={{
          background: 'linear-gradient(145deg, rgba(33,133,213,0.25), rgba(129,140,248,0.12), rgba(255,255,255,0.04))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-[calc(1rem-1px)] p-6"
          style={{
            background: 'var(--surface-2)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* Accent bar */}
          <div className="accent-bar mb-5" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-all duration-200 hover:bg-white/[0.06]"
            style={{ color: 'var(--text-3)' }}
          >
            <X className="w-4 h-4" />
          </button>

          {title && (
            <h3 className="text-base font-semibold text-white mb-4 pr-6">{title}</h3>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
