'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import FreelancerCard from '@/components/freelancers/FreelancerCard';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { Search, Users, SlidersHorizontal } from 'lucide-react';
import type { SearchFreelancer } from '@/types';

interface Category {
  _id: string;
  name: string;
}

export default function FreelancersPage() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [minRep, setMinRep] = useState(0);
  const [freelancers, setFreelancers] = useState<SearchFreelancer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Load categories from the real API
  useEffect(() => {
    api.get('/categories')
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const fetchFreelancers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Filter by reputation category_id — matches SearchIndexFreelancers.categories array
      if (selectedCategoryId) params.set('category_id', selectedCategoryId);
      if (minRep > 0) params.set('min_reputation', String(minRep));
      params.set('limit', '50');
      const res = await api.get(`/users/search/freelancers?${params.toString()}`);
      const data = res.data;
      setFreelancers(Array.isArray(data?.freelancers) ? data.freelancers : Array.isArray(data) ? data : []);
    } catch {
      setFreelancers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, minRep]);

  useEffect(() => { fetchFreelancers(); }, [fetchFreelancers]);

  // Client-side search filter (by username/bio)
  const filtered = freelancers.filter((f) => {
    if (!search) return true;
    const name = f.user_id?.username || '';
    const bio = f.user_id?.bio || '';
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || bio.toLowerCase().includes(q);
  });

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-40 -right-40 opacity-[0.07]" style={{ background: '#818cf8' }} />
          <div className="glow-orb w-[400px] h-[400px] -bottom-32 -left-32 opacity-[0.06]" style={{ background: '#2185D5' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="animate-fade-up mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Talento
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Freelancers</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
              Encuentra talento verificado con reputación on-chain
            </p>
          </div>

          {/* Filters */}
          <div className="animate-fade-up delay-100 space-y-4 mb-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base pl-10"
              />
            </div>

            {/* Category pills — loaded from real /categories API */}
            <div className="flex flex-wrap gap-2">
              {/* "Todos" pill */}
              <button
                onClick={() => setSelectedCategoryId(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                style={selectedCategoryId === null ? {
                  background: 'linear-gradient(135deg, #2185D5, #818cf8)',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(33,133,213,0.35)',
                } : {
                  background: 'var(--surface-2)',
                  color: 'var(--text-3)',
                  border: '1px solid var(--border)',
                }}
              >
                Todos
              </button>

              {/* Real category pills */}
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategoryId(cat._id)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={selectedCategoryId === cat._id ? {
                    background: 'linear-gradient(135deg, #2185D5, #818cf8)',
                    color: '#fff',
                    boxShadow: '0 2px 12px rgba(33,133,213,0.35)',
                  } : {
                    background: 'var(--surface-2)',
                    color: 'var(--text-3)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Reputation slider */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <SlidersHorizontal className="w-4 h-4 shrink-0 text-[#2185D5]" />
              <span className="text-[10.5px] font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                Reputación mín.
              </span>
              <input
                type="range"
                min={0}
                max={200}
                value={minRep}
                onChange={(e) => setMinRep(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: '#2185D5' }}
              />
              <span
                className="text-sm font-bold min-w-[40px] text-right tabular-nums"
                style={{ color: minRep > 0 ? '#60b8f0' : 'var(--text-3)' }}
              >
                {minRep}
              </span>
            </div>

            {/* Active filter badge */}
            {selectedCategoryId && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>Categoría:</span>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(33,133,213,0.12)', color: '#60b8f0', border: '1px solid rgba(33,133,213,0.2)' }}
                >
                  {categories.find(c => c._id === selectedCategoryId)?.name}
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="hover:text-white transition-colors"
                  >×</button>
                </span>
              </div>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin freelancers"
              description={selectedCategoryId
                ? `Ningún freelancer tiene reputación en ${categories.find(c => c._id === selectedCategoryId)?.name || 'esta categoría'} aún.`
                : 'No se encontraron freelancers con estos filtros.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((f, i) => (
                <div key={f._id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <FreelancerCard freelancer={f} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
