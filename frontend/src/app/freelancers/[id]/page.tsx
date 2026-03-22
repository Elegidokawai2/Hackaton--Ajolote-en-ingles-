'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Avatar from '@/components/ui/Avatar';
import ReputationBar from '@/components/ui/ReputationBar';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { truncateAddress } from '@/lib/utils';
import { ExternalLink, Briefcase, Clock, Star, Copy } from 'lucide-react';
import type { UserWithProfile, FreelancerProfile, Reputation } from '@/types';

export default function FreelancerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<UserWithProfile | null>(null);
  const [reputations, setReputations] = useState<Reputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stellarAddress, setStellarAddress] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Step 1: fetch the user by MongoDB _id (backend also supports this)
        const userRes = await api.get(`/users/${params.id}`);
        const payload = userRes.data?.data ?? userRes.data;
        const normalized: UserWithProfile = {
          user: payload?.user ?? payload,
          profile: payload?.profile ?? null,
        };
        setData(normalized);

        // Step 2: use the freelancer's stellar_public_key for the reputation call
        const freelancerPubKey = normalized.user?.stellar_public_key;
        setStellarAddress(freelancerPubKey || '');

        if (freelancerPubKey) {
          try {
            const repRes = await api.get(`/reputation/${freelancerPubKey}`);
            const repPayload = repRes.data?.data ?? repRes.data;
            // Reputation endpoint returns { slug: score } map — convert to Reputation[]
            if (repPayload && typeof repPayload === 'object' && !Array.isArray(repPayload)) {
              const reps = Object.entries(repPayload)
                .filter(([, score]) => Number(score) > 0)
                .map(([slug, score], i) => ({
                  _id: slug + i,
                  user_id: normalized.user?._id || '',
                  category_id: slug,
                  score: Number(score),
                  level: Number(score) >= 100 ? 'gold' : Number(score) >= 50 ? 'silver' : 'bronze',
                  created_at: '',
                  updated_at: '',
                }));
              setReputations(reps as unknown as Reputation[]);
            } else {
              setReputations(Array.isArray(repPayload) ? repPayload : []);
            }
          } catch {
            setReputations([]);
          }
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <ProtectedRoute><Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <Spinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute><Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <p style={{ color: 'var(--text-3)' }}>Usuario no encontrado</p>
        </div>
      </ProtectedRoute>
    );
  }

  const profile = data.profile as FreelancerProfile | null;
  const addr = stellarAddress || 'GBCMOCQAXS5GHPBZLSEDQN7AMXHSX7V6YUPOT53KPWRLED5PQFG4TCY';
  const totalScore = reputations.reduce((sum, r) => sum + r.score, 0);

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* BG orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-32 -left-32 opacity-[0.08]" style={{ background: '#818cf8' }} />
          <div className="glow-orb w-[400px] h-[400px] -bottom-24 -right-32 opacity-[0.06]" style={{ background: '#2185D5' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

            {/* Main */}
            <div className="space-y-5">
              {/* Profile hero */}
              <div
                className="animate-fade-up rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
              >
                {/* Gradient header */}
                <div
                  className="h-28 relative"
                  style={{ background: 'linear-gradient(135deg, rgba(33,133,213,0.20) 0%, rgba(129,140,248,0.15) 100%)' }}
                >
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(33,133,213,0.25), transparent 60%)' }} />
                </div>
                <div className="px-6 pb-6 -mt-10 relative">
                  <div className="flex items-end gap-4 mb-4">
                    <div className="rounded-full p-0.5" style={{ background: 'var(--surface)' }}>
                      <Avatar name={data.user.username} size="xl" />
                    </div>
                    <div className="mb-1">
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-white">{data.user.username}</h1>
                        {/* Online indicator */}
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[#2185D5]" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2185D5]" />
                        </span>
                      </div>
                      {profile && <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{profile.title}</p>}
                    </div>
                  </div>

                  {/* Stellar address row */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{truncateAddress(addr, 10)}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(addr)}
                      className="p-1 rounded transition-colors duration-150 hover:bg-white/[0.05]"
                      style={{ color: 'var(--text-3)' }}
                    ><Copy className="w-3 h-3" /></button>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${addr}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-150"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver on-chain
                    </a>
                  </div>

                  {profile?.description && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{profile.description}</p>
                  )}

                  {/* Skills */}
                  {profile?.skills && profile.skills.length > 0 && (
                    <div className="mt-5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Habilidades</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(33,133,213,0.10)', color: '#60b8f0', border: '1px solid rgba(33,133,213,0.18)' }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reputation */}
              <div
                className="animate-fade-up delay-100 rounded-2xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#2185D5]" />
                    <h2 className="text-sm font-semibold text-white">Reputación on-chain</h2>
                  </div>
                  {totalScore > 0 && (
                    <span className="text-xs font-bold tabular-nums text-[#60b8f0]">{totalScore} pts total</span>
                  )}
                </div>
                {reputations.length > 0 ? (
                  <div className="space-y-5">
                    {reputations.map((rep) => {
                      const catName = typeof rep.category_id === 'object'
                        ? (rep.category_id as { name: string }).name : 'Categoría';
                      return <ReputationBar key={rep._id} label={catName} score={rep.score} />;
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sin reputación registrada aún.</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div
                className="animate-fade-up delay-150 rounded-2xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>Información</p>
                <div className="space-y-3">
                  {profile && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(33,133,213,0.10)' }}>
                        <Briefcase className="w-3.5 h-3.5 text-[#2185D5]" />
                      </div>
                      <span className="text-sm capitalize" style={{ color: 'var(--text-2)' }}>{profile.experience_level}</span>
                    </div>
                  )}
                  {profile?.availability && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(33,133,213,0.10)' }}>
                        <Clock className="w-3.5 h-3.5 text-[#2185D5]" />
                      </div>
                      <span className="text-sm capitalize" style={{ color: 'var(--text-2)' }}>{profile.availability}</span>
                    </div>
                  )}
                </div>

                {user?.role === 'recruiter' && (
                  <>
                    <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/projects/create?freelancer_id=${params.id}`)}
                    >
                      <Briefcase className="w-4 h-4" />
                      Contratar freelancer
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
