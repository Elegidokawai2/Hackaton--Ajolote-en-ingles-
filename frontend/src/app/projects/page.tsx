'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import ProjectCard from '@/components/projects/ProjectCard';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { Plus, Briefcase } from 'lucide-react';
import type { Project } from '@/types';

type Tab = 'active' | 'completed' | 'all';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch {}
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const filtered = projects.filter((p) => {
    if (tab === 'active') return !['completed', 'rejected', 'cancelled'].includes(p.status);
    if (tab === 'completed') return p.status === 'completed';
    return true;
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Activos', count: projects.filter(p => !['completed', 'rejected', 'cancelled'].includes(p.status)).length },
    { key: 'completed', label: 'Completados', count: projects.filter(p => p.status === 'completed').length },
    { key: 'all', label: 'Todos', count: projects.length },
  ];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* BG orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-40 left-0 opacity-[0.07]" style={{ background: '#2185D5' }} />
          <div className="glow-orb w-[400px] h-[400px] -bottom-32 right-0 opacity-[0.05]" style={{ background: '#818cf8' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="animate-fade-up flex items-end justify-between mb-8">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
                Contratos 1:1
              </p>
              <h1 className="text-3xl font-bold text-white tracking-tight">Proyectos</h1>
              <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
                Gestiona tus contratos privados con garantía escrow
              </p>
            </div>
            {user?.role === 'recruiter' && (
              <Button onClick={() => router.push('/projects/create')}>
                <Plus className="w-4 h-4" />
                Nuevo proyecto
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="animate-fade-up delay-100 flex gap-1 mb-7 p-1 w-fit rounded-xl" style={{ background: 'var(--surface)' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={tab === t.key ? {
                  background: 'linear-gradient(135deg, #2185D5, #818cf8)',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(33,133,213,0.30)',
                } : {
                  color: 'var(--text-3)',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={tab === t.key ? { background: 'rgba(255,255,255,0.20)' } : { background: 'var(--surface-3)', color: 'var(--text-3)' }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Sin proyectos"
              description="No tienes proyectos en esta categoría aún."
              actionLabel={user?.role === 'recruiter' ? 'Crear proyecto' : undefined}
              onAction={user?.role === 'recruiter' ? () => router.push('/projects/create') : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((project, i) => (
                <div key={project._id} className="animate-fade-up" style={{ animationDelay: `${i * 55}ms` }}>
                  <ProjectCard project={project} currentUserId={user?._id || ''} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
