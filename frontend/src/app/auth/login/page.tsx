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
    <svg width="38" height="42" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2185D5" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="url(#lg)" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
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
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(33,133,213,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(129,140,248,0.10) 0%, transparent 60%), #050508' }}
    >
      {/* Glow orbs */}
      <div className="glow-orb w-[480px] h-[480px] -top-32 -left-24" style={{ background: '#2185D5' }} />
      <div className="glow-orb w-[380px] h-[380px] -bottom-24 -right-16 opacity-10 animate-float" style={{ background: '#818cf8' }} />

      {/* Card */}
      <div
        className="animate-scale-in relative z-10 w-full max-w-sm rounded-2xl p-px overflow-hidden"
        style={{ background: 'linear-gradient(145deg, rgba(33,133,213,0.35), rgba(129,140,248,0.15), rgba(255,255,255,0.04))' }}
      >
        <div
          className="bg-[#0e0e14] rounded-[calc(1rem-1px)] p-8"
          style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="p-3.5 rounded-2xl mb-4 animate-glow"
              style={{
                background: 'linear-gradient(135deg, rgba(33,133,213,0.15), rgba(129,140,248,0.10))',
                border: '1px solid rgba(33,133,213,0.25)',
              }}
            >
              <HexLogo />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Nuup</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Tu sesión te espera</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="animate-fade-up delay-50">
              <Input label="Email" type="email" placeholder="tu@email.com" error={errors.email?.message} {...register('email')} />
            </div>
            <div className="animate-fade-up delay-100">
              <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
            </div>
            <div className="animate-fade-up delay-150 pt-1">
              <Button type="submit" className="w-full" loading={loading}>Iniciar sesión</Button>
            </div>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
            ¿No tienes cuenta?{' '}
            <Link href="/auth/register" className="font-semibold text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-200">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
