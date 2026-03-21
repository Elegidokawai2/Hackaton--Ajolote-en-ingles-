'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { sileo } from 'sileo';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

function HexLogo() {
  return (
    <svg width="36" height="40" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="#81DA47" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const promise = api.post('/auth/login', data);

    sileo.promise(promise, {
      loading: { title: 'Iniciando sesión...' },
      success: { title: 'Bienvenido', description: 'Sesión iniciada correctamente' },
      error: { title: 'Error al iniciar sesión' },
    });

    try {
      const res = await promise;
      setAuth(res.data);
      router.push('/dashboard');
    } catch {
      // handled by toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #f8f8f7 0%, #f0f0ef 100%)' }}>
      {/* Decorative blob */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #81DA47, transparent)' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #81DA47, transparent)' }} />
      </div>

      <div className="animate-scale-in bg-white rounded-2xl border border-black/[0.06] p-8 w-full max-w-sm relative"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl bg-zinc-950 mb-4"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <HexLogo />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            ProofWork
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="animate-fade-up delay-50">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="animate-fade-up delay-100">
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
          <div className="animate-fade-up delay-150">
            <Button type="submit" className="w-full mt-1" loading={loading}>
              Iniciar sesión
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-zinc-900 font-semibold hover:text-[#6bc438] transition-colors duration-150">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
