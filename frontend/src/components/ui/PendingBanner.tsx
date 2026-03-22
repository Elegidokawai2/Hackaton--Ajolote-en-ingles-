import React from 'react';
import { Info } from 'lucide-react';

export default function PendingBanner() {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs mb-4"
      style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.22)',
        color: 'rgba(251,191,36,0.85)',
      }}
    >
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>Esta sección aún no está conectada al backend. Los datos mostrados son de ejemplo.</span>
    </div>
  );
}
