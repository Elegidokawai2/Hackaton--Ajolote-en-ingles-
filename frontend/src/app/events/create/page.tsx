'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { formatMXN } from '@/lib/utils';
import { sileo } from 'sileo';
import { AlertCircle, Zap, Wallet } from 'lucide-react';

const eventSchema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres'),
  description: z.string().min(20, 'Mínimo 20 caracteres'),
  category_id: z.string().min(1, 'Categoría requerida'),
  prize_amount: z.coerce.number().min(100, 'Mínimo $100 MXN'),
  max_winners: z.coerce.number().min(1, 'Al menos 1 ganador'),
  deadline_submission: z.string().min(1, 'Fecha requerida'),
  deadline_selection: z.string().min(1, 'Fecha requerida'),
});
type EventForm = z.infer<typeof eventSchema>;

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [backendError, setBackendError] = useState('');

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    api.get('/wallets/balance')
      .then((res) => setWalletBalance(res.data.balance_mxne ?? 0))
      .catch(() => setWalletBalance(0));
  }, []);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { max_winners: 1 },
  });

  const prizeAmount = watch('prize_amount');

  const onSubmit = async (data: EventForm) => {
    setBackendError('');
    setLoading(true);
    try {
      const res = await api.post('/events', { ...data, status: 'active' });
      sileo.success({ title: 'Evento creado', description: 'Tu evento está activo' });
      router.push(`/events/${res.data._id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear el evento';
      setBackendError(msg);
      sileo.error({ title: 'Error', description: msg });
    }
    setLoading(false);
  };

  return (
    <ProtectedRoute requiredRole="recruiter">
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* BG orb */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-32 -right-32 opacity-[0.07]" style={{ background: '#2185D5' }} />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
          <div className="animate-fade-up mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Crear competencia
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Nuevo evento</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>Publica un reto para que los freelancers compitan</p>
          </div>

          <div className="animate-fade-up delay-100 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Wallet balance hint */}
            {walletBalance !== null && (
              <div
                className="flex items-center gap-2.5 mb-5 px-3.5 py-2.5 rounded-xl text-xs"
                style={walletBalance === 0 ? {
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  color: 'rgba(248,113,113,0.9)',
                } : {
                  background: 'rgba(33,133,213,0.07)',
                  border: '1px solid rgba(33,133,213,0.18)',
                  color: 'var(--text-2)',
                }}
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span>Saldo disponible: <strong className="text-white">{formatMXN(walletBalance)}</strong> MXNe
                  {walletBalance === 0 && ' — Deposita fondos antes de crear un evento'}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Título del evento" placeholder="Ej: Diseña el logo de nuestra startup fintech" error={errors.title?.message} {...register('title')} />
              <Textarea label="Descripción" placeholder="Describe los requisitos, entregables y criterios de evaluación…" error={errors.description?.message} {...register('description')} />
              <Select
                label="Categoría"
                placeholder="Selecciona una categoría"
                options={categories.map((c) => ({ value: c._id, label: c.name }))}
                error={errors.category_id?.message}
                {...register('category_id')}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input label="Premio (MXN)" type="number" placeholder="2500" error={errors.prize_amount?.message} {...register('prize_amount')} />
                  {prizeAmount > 0 && walletBalance !== null && prizeAmount > walletBalance && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Saldo insuficiente ({formatMXN(walletBalance)})
                    </p>
                  )}
                  {prizeAmount > 0 && (walletBalance === null || prizeAmount <= walletBalance) && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                      Se bloqueará {formatMXN(prizeAmount)} en Soroban
                    </p>
                  )}
                </div>
                <Input label="Máx. ganadores" type="number" placeholder="1" error={errors.max_winners?.message} {...register('max_winners')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cierre de entregas" type="date" error={errors.deadline_submission?.message} {...register('deadline_submission')} />
                <Input label="Fecha de selección" type="date" error={errors.deadline_selection?.message} {...register('deadline_selection')} />
              </div>

              {backendError && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs text-red-400" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{backendError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={loading}>
                  <Zap className="w-4 h-4" /> Publicar evento
                </Button>
                <Button variant="secondary" type="button" onClick={() => router.back()}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
