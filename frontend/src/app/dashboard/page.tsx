'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import ReputationBar from '@/components/ui/ReputationBar';
import Badge, { getStatusVariant } from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import PendingBanner from '@/components/ui/PendingBanner';
import { formatMXN, formatDate } from '@/lib/utils';
import { ArrowRight, TrendingUp, Briefcase, Zap, Wallet } from 'lucide-react';
import type { Event, Project, Reputation, Wallet as WalletType } from '@/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reputations, setReputations] = useState<Reputation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [walletRes, eventsRes, projectsRes] = await Promise.allSettled([
          api.get('/wallets'), api.get('/events'), api.get('/projects'),
        ]);
        if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data);
        if (eventsRes.status === 'fulfilled') {
          const d = eventsRes.value.data;
          setEvents((Array.isArray(d) ? d : []).slice(0, 4));
        }
        if (projectsRes.status === 'fulfilled') {
          const d = projectsRes.value.data;
          setProjects((Array.isArray(d) ? d : []).slice(0, 4));
        }
        if (user) {
          try {
            const r = await api.get(`/reputation/${user._id}`);
            setReputations(Array.isArray(r.data) ? r.data : []);
          } catch {}
        }
      } catch {}
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm animate-pulse" style={{ color: 'var(--text-3)' }}>Cargando…</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>

        {/* Background glow orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[600px] h-[600px] -top-48 -left-32 opacity-[0.08]" style={{ background: '#2185D5' }} />
          <div className="glow-orb w-[500px] h-[500px] top-1/2 -right-40 opacity-[0.06]" style={{ background: '#818cf8' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          <PendingBanner />

          {/* Welcome card */}
          <div className="animate-fade-up mt-6 mb-6">
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, #0c0c18 0%, #111128 60%, #0c0c18 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Gradient blob inside card */}
              <div
                className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-25 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #2185D5, transparent 70%)', filter: 'blur(40px)' }}
              />
              <div
                className="absolute -bottom-12 left-20 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)', filter: 'blur(40px)' }}
              />

              {/* Top accent gradient bar */}
              <div className="accent-bar" />

              <div className="p-6 relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
                    {user?.role === 'recruiter' ? '● Panel Reclutador' : '● Panel Freelancer'}
                  </p>
                  <h1 className="text-3xl font-bold text-white tracking-tight leading-none">
                    Hola, <span className="gradient-text">{user?.username}</span>
                  </h1>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
                    {user?.role === 'recruiter'
                      ? 'Gestiona proyectos y encuentra el mejor talento'
                      : 'Explora eventos y construye tu reputación on-chain'}
                  </p>
                </div>
                <div
                  className="shrink-0 rounded-2xl px-6 py-4 text-right"
                  style={{
                    background: 'rgba(33,133,213,0.08)',
                    border: '1px solid rgba(33,133,213,0.20)',
                  }}
                >
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <Wallet className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
                    <p className="text-[10.5px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Saldo on-chain</p>
                  </div>
                  {wallet?.on_chain_balances && wallet.on_chain_balances.length > 0 ? (
                    <div>
                      {wallet.on_chain_balances.slice(0, 2).map((b, i) => (
                        <p key={i} className="text-2xl font-bold text-white tabular-nums">
                          {parseFloat(b.balance).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          <span className="text-sm ml-1 font-semibold text-[#60b8f0]">{b.asset_code || b.asset_type}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-3xl font-bold text-white tabular-nums">0.00</p>
                  )}
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Stellar Network</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reputation */}
          {user?.role === 'freelancer' && reputations.length > 0 && (
            <div className="animate-fade-up delay-100 mb-5">
              <div
                className="card p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-4 h-4 text-[#2185D5]" />
                  <h2 className="text-sm font-semibold text-white">Reputación on-chain</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {reputations.map((rep) => {
                    const catName = typeof rep.category_id === 'object'
                      ? (rep.category_id as { name: string }).name : 'Categoría';
                    return <ReputationBar key={rep._id} label={catName} score={rep.score} />;
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Events */}
            <div className="animate-fade-up delay-200">
              <div className="card p-5 h-full" style={{ background: 'var(--surface)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#2185D5]" />
                    <h2 className="text-sm font-semibold text-white">
                      {user?.role === 'recruiter' ? 'Mis eventos' : 'Eventos recientes'}
                    </h2>
                  </div>
                  <button
                    onClick={() => router.push('/events')}
                    className="group flex items-center gap-1 text-[11px] font-medium text-[#60b8f0] hover:text-white transition-colors duration-200"
                  >
                    Ver todos <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>
                {events.length > 0 ? (
                  <div className="space-y-1.5">
                    {events.map((e, i) => (
                      <div
                        key={e._id}
                        onClick={() => router.push(`/events/${e._id}`)}
                        className="list-item flex items-center justify-between p-3 rounded-xl cursor-pointer"
                        style={{
                          border: '1px solid var(--border)',
                          animationDelay: `${(i + 3) * 70}ms`,
                        }}
                      >
                        <div className="min-w-0 flex-1 pl-2">
                          <p className="text-sm font-medium text-white truncate">{e.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{formatDate(e.deadline_submission)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="text-sm font-bold text-white tabular-nums">{formatMXN(e.prize_amount)}</span>
                          <Badge variant={getStatusVariant(e.status)}>{undefined}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Zap className="w-8 h-8 mb-2 opacity-20 text-[#2185D5]" />
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>No hay eventos aún</p>
                  </div>
                )}
              </div>
            </div>

            {/* Projects */}
            <div className="animate-fade-up delay-300">
              <div className="card p-5 h-full" style={{ background: 'var(--surface)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#818cf8]" />
                    <h2 className="text-sm font-semibold text-white">Proyectos activos</h2>
                  </div>
                  <button
                    onClick={() => router.push('/projects')}
                    className="group flex items-center gap-1 text-[11px] font-medium text-[#60b8f0] hover:text-white transition-colors duration-200"
                  >
                    Ver todos <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>
                {projects.length > 0 ? (
                  <div className="space-y-1.5">
                    {projects.map((p, i) => (
                      <div
                        key={p._id}
                        onClick={() => router.push(`/projects/${p._id}`)}
                        className="list-item flex items-center justify-between p-3 rounded-xl cursor-pointer"
                        style={{
                          border: '1px solid var(--border)',
                          animationDelay: `${(i + 3) * 70}ms`,
                        }}
                      >
                        <div className="min-w-0 flex-1 pl-2">
                          <p className="text-sm font-medium text-white truncate">{p.title}</p>
                          <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>{formatMXN(p.amount)}</p>
                        </div>
                        <Badge variant={getStatusVariant(p.status)}>{undefined}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Briefcase className="w-8 h-8 mb-2 opacity-20 text-[#818cf8]" />
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>No hay proyectos aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
