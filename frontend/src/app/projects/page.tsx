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
        setProjects(res.data);
      } catch { }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const filtered = projects.filter((p) => {
    if (tab === 'active') return !['completed', 'rejected', 'cancelled'].includes(p.status);
    if (tab === 'completed') return p.status === 'completed';
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Activos' },
    { key: 'completed', label: 'Completados' },
    { key: 'all', label: 'Todos' },
  ];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen bg-zinc-100">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Proyectos</h1>
              <p className="text-sm text-zinc-500 mt-1">Gestiona tus contratos 1:1</p>
            </div>
            {user?.role === 'recruiter' && (
              <Button onClick={() => router.push('/projects/create')}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nuevo proyecto
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${tab === t.key
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Sin proyectos"
              description="No tienes proyectos en esta categoría aún."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  currentUserId={user?._id || ''}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
