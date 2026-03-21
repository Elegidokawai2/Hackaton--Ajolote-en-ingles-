import React from 'react';

interface ReputationBarProps {
  label: string;
  score: number;
  maxScore?: number;
}

export default function ReputationBar({ label, score, maxScore = 200 }: ReputationBarProps) {
  const pct = Math.min((score / maxScore) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-widest">
          {label}
        </span>
        <span className="text-sm font-bold text-zinc-900">{score} <span className="text-xs font-normal text-zinc-400">pts</span></span>
      </div>
      <div className="rep-bar-track">
        <div
          className="rep-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
