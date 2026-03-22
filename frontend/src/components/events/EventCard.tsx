'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Badge, { getStatusVariant } from '@/components/ui/Badge';
import { formatMXN, formatDate } from '@/lib/utils';
import { Calendar, Users, Trophy } from 'lucide-react';
import type { Event, Category } from '@/types';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const router = useRouter();
  const categoryName = typeof event.category_id === 'object'
    ? (event.category_id as Category).name
    : 'General';

  return (
    <div
      onClick={() => router.push(`/events/${event._id}`)}
      className="card card-clickable p-5 relative overflow-hidden flex flex-col gap-3 group"
      style={{ background: 'var(--surface)' }}
    >
      {/* Subtle top gradient hover glow */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, #2185D5, #818cf8)' }}
      />

      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(33,133,213,0.10)', color: '#60b8f0', border: '1px solid rgba(33,133,213,0.18)' }}
        >
          {categoryName}
        </span>
        <Badge variant={getStatusVariant(event.status)}>{undefined}</Badge>
      </div>

      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">{event.title}</h3>

      <div className="flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 text-[#2185D5]" />
        <p className="text-xl font-bold text-white tabular-nums">{formatMXN(event.prize_amount)}</p>
      </div>

      <div className="flex items-center gap-4 text-xs mt-auto pt-2" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(event.deadline_submission)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {event.max_winners} ganador{event.max_winners > 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  );
}
