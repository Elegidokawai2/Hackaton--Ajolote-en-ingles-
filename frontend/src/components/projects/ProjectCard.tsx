'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge, { getStatusVariant } from '@/components/ui/Badge';
import { formatMXN } from '@/lib/utils';
import { DollarSign } from 'lucide-react';
import type { Project, User as UserType } from '@/types';

interface ProjectCardProps {
  project: Project;
  currentUserId: string;
}

export default function ProjectCard({ project, currentUserId }: ProjectCardProps) {
  const router = useRouter();

  const isRecruiter = typeof project.recruiter_id === 'object'
    ? (project.recruiter_id as UserType)._id === currentUserId
    : project.recruiter_id === currentUserId;

  const otherParty = isRecruiter
    ? (typeof project.freelancer_id === 'object' ? (project.freelancer_id as UserType).username : 'Freelancer')
    : (typeof project.recruiter_id === 'object' ? (project.recruiter_id as UserType).username : 'Reclutador');

  return (
    <div
      onClick={() => router.push(`/projects/${project._id}`)}
      className="card card-clickable p-5 relative overflow-hidden group"
      style={{ background: 'var(--surface)' }}
    >
      {/* Top gradient bar on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, #818cf8, #2185D5)' }}
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar name={otherParty} size="sm" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{otherParty}</span>
        </div>
        <Badge variant={getStatusVariant(project.status)}>{undefined}</Badge>
      </div>

      <h3 className="text-sm font-semibold text-white mb-3 line-clamp-2">{project.title}</h3>

      <div className="flex items-center gap-1.5">
        <DollarSign className="w-3.5 h-3.5 text-[#2185D5]" />
        <p className="text-xl font-bold text-white tabular-nums">{formatMXN(project.amount)}</p>
      </div>
    </div>
  );
}
