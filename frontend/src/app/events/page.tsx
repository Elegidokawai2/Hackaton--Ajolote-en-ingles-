'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import EventCard from '@/components/events/EventCard';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import CustomSelect from '@/components/ui/CustomSelect';
import { Plus, Search, Calendar } from 'lucide-react';
import type { Event } from '@/types';

export default function EventsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => { });
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const params = new URLSearchParams();
        if (categoryFilter) params.set('category_id', categoryFilter);
        const res = await api.get(`/events?${params.toString()}`);
        setEvents(res.data);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [categoryFilter]);

  const filtered = events.filter((e) =>
    (e.title || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="animate-fade-up flex items-end justify-between mb-8">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
                {user?.role === 'recruiter' ? 'Mis eventos' : 'Explorar'}
              </p>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {user?.role === 'recruiter' ? 'Eventos publicados' : 'Eventos'}
              </h1>
              <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
                {user?.role === 'recruiter'
                  ? 'Gestiona tus competencias y revisa participaciones'
                  : 'Encuentra oportunidades y compite por premios reales'}
              </p>
            </div>
            {user?.role === 'recruiter' && (
              <Button onClick={() => router.push('/events/create')}>
                <Plus className="w-4 h-4" />
                Crear evento
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-7">            {/* Search */}
            <div className="relative flex-1 z-1000">
              <input
                type="text"
                placeholder="Buscar eventos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base pl-9"
              />
            </div>

            {/* Category – custom select */}
            <div className="sm:w-56 z-1000">
              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                placeholder="Todas las categorías"
                options={categories?.length > 0 ? categories.map((c) => ({ value: c._id, label: c.name })) : []}
              />
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin eventos"
              description="Aún no hay eventos disponibles. Vuelve pronto."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((event, i) => (
                <div
                  key={event._id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
