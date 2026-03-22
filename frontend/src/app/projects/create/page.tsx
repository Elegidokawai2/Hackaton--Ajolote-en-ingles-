'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { formatMXN } from '@/lib/utils';
import { sileo } from 'sileo';
import { Briefcase, ArrowRight, Lock, Wallet } from 'lucide-react';

const projectSchema = z.object({
  freelancer_id: z.string().min(1, 'Freelancer requerido'),
  category_id: z.string().min(1, 'Categoría requerida'),
  title: z.string().min(5, 'Mínimo 5 caracteres'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  amount: z.coerce.number().min(100, 'Mínimo $100 MXN'),
  deadline: z.string().min(1, 'Deadline requerido'),
});
type ProjectForm = z.infer<typeof projectSchema>;

export default function CreateProjectPage() {
  return (
    <Suspense>
      <CreateProjectContent />
    </Suspense>
  );
}

function CreateProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    api.get('/wallets/balance')
      .then((res) => setWalletBalance(res.data.balance_mxne ?? 0))
      .catch(() => setWalletBalance(0));
  }, []);

  const prefilledFreelancer = searchParams.get('freelancer_id') || '';

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { freelancer_id: prefilledFreelancer },
  });

  // Coerce to number explicitly to avoid string concatenation bug
  const rawAmount = watch('amount');
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) || 0 : (rawAmount || 0);
  const insufficient = walletBalance !== null && amount > 0 && amount > walletBalance;

  const onSubmit = async (data: ProjectForm) => {
    setLoading(true);
    // Send only what the backend needs — no guarantee field
    const promise = api.post('/projects', {
      freelancer_id: data.freelancer_id,
      recruiter_id: user?._id,
      category_id: data.category_id,
      title: data.title,
      description: data.description,
      amount: Number(data.amount),
      deadline: data.deadline,
    });
    sileo.promise(promise, {
      loading: { title: 'Creando proyecto…' },
      success: { title: 'Proyecto creado', description: 'Propuesta enviada al freelancer' },
      error: { title: 'Error al crear proyecto' },
    });
    try {
      const res = await promise;
      router.push(`/projects/${res.data._id}`);
    } catch { }
    setLoading(false);
  };

  return (
    <ProtectedRoute requiredRole="recruiter">
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-32 -left-32 opacity-[0.07]" style={{ background: '#818cf8' }} />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
          <div className="animate-fade-up mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Contrato privado
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Nuevo proyecto</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
              El monto queda en escrow hasta que apruebes la entrega
            </p>
          </div>

          {/* Wallet balance hint */}
          {walletBalance !== null && (
            <div
              className="animate-fade-up flex items-center gap-2.5 mb-5 px-3.5 py-2.5 rounded-xl text-xs"
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
                {walletBalance === 0 && ' — Deposita fondos antes de crear un proyecto'}
              </span>
            </div>
          )}

          <div className="animate-fade-up delay-100 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="ID del Freelancer"
                placeholder="MongoDB ID del freelancer"
                error={errors.freelancer_id?.message}
                {...register('freelancer_id')}
              />
              <Select
                label="Categoría"
                placeholder="Selecciona una categoría"
                options={categories.map((c) => ({ value: c._id, label: c.name }))}
                error={errors.category_id?.message}
                {...register('category_id')}
              />
              <Input
                label="Título del proyecto"
                placeholder="Ej: Rediseño de landing page"
                error={errors.title?.message}
                {...register('title')}
              />
              <Textarea
                label="Descripción"
                placeholder="Describe el alcance, entregables y requisitos…"
                error={errors.description?.message}
                {...register('description')}
              />
              <div>
                <Input
                  label="Monto (MXN)"
                  type="number"
                  placeholder="3500"
                  error={errors.amount?.message}
                  {...register('amount')}
                />

                {/* Amount summary */}
                {amount > 0 && (
                  <div
                    className="mt-2 flex items-center justify-between rounded-xl px-4 py-3 text-sm animate-fade-up"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Se bloquea en escrow</span>
                    </div>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: insufficient ? '#f87171' : '#4ade80' }}
                    >
                      {formatMXN(amount)}
                      {insufficient && <span className="text-[10px] ml-1.5 font-normal">saldo insuficiente</span>}
                    </span>
                  </div>
                )}
              </div>

              <Input
                label="Deadline"
                type="date"
                error={errors.deadline?.message}
                {...register('deadline')}
              />

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={loading} disabled={insufficient}>
                  <Briefcase className="w-4 h-4" /> Enviar propuesta <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
