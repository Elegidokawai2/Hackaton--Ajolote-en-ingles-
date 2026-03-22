'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import ReputationBar from '@/components/ui/ReputationBar';
import { Star } from 'lucide-react';
import type { SearchFreelancer } from '@/types';

interface FreelancerCardProps {
  freelancer: SearchFreelancer;
}

export default function FreelancerCard({ freelancer }: FreelancerCardProps) {
  const router = useRouter();
  const username = freelancer.user_id?.username || 'Freelancer';
  const userId = freelancer.user_id?._id || freelancer._id;

  return (
    <div
      onClick={() => router.push(`/freelancers/${userId}`)}
      className="card card-clickable p-5 relative overflow-hidden group"
      style={{ background: 'var(--surface)' }}
    >
      {/* Top gradient bar on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, #2185D5, #818cf8)' }}
      />

      <div className="flex items-start gap-3 mb-4">
        <Avatar name={username} size="lg" />
        <div>
          <h3 className="text-sm font-semibold text-white">{username}</h3>
          {freelancer.title && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{freelancer.title}</p>
          )}
          {freelancer.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {freelancer.skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'rgba(33,133,213,0.10)', color: '#60b8f0', border: '1px solid rgba(33,133,213,0.15)' }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <ReputationBar label="Reputación" score={freelancer.reputation_score || 0} />
        <div className="flex items-center justify-between text-xs pt-1" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <span>{freelancer.completed_projects || 0} proyectos</span>
          {freelancer.rating > 0 && (
            <span className="flex items-center gap-1 text-[#fbbf24]">
              <Star className="w-3 h-3" /> {freelancer.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
