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

const registerSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['Freelancer', 'Recruiter'], { required_error: 'Selecciona un rol' }),
});
type RegisterForm = z.infer<typeof registerSchema>;

function HexLogo() {
  return (
    <svg width="38" height="42" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2185D5" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="url(#lg2)" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'Freelancer' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const regPromise = api.post('/auth/register', data);
      sileo.promise(regPromise, {
        loading: { title: 'Creando cuenta...' },
        success: { title: 'Cuenta creada' },
        error: { title: 'Error al crear cuenta' },
      });
      await regPromise;
      const loginRes = await api.post('/auth/login', { email: data.email, password: data.password });
      const { token, user } = loginRes.data.data || loginRes.data;
      if (token) localStorage.setItem('pw_token', token);
      setAuth(user);
      router.push('/dashboard');
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 70% 55% at 20% 10%, rgba(129,140,248,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(33,133,213,0.14) 0%, transparent 60%), #050508' }}
    >
      <div className="glow-orb w-[420px] h-[420px] -top-24 -right-20 opacity-[0.12]" style={{ background: '#818cf8' }} />
      <div className="glow-orb w-[400px] h-[400px] -bottom-20 -left-16 animate-float" style={{ background: '#2185D5' }} />

      <div
        className="animate-scale-in relative z-10 w-full max-w-sm rounded-2xl p-px overflow-hidden"
        style={{ background: 'linear-gradient(145deg, rgba(129,140,248,0.30), rgba(33,133,213,0.20), rgba(255,255,255,0.03))' }}
      >
        <div className="bg-[#0e0e14] rounded-[calc(1rem-1px)] p-8" style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
          <div className="flex flex-col items-center mb-7">
            <div
              className="p-3.5 rounded-2xl mb-4 animate-glow"
              style={{
                background: 'linear-gradient(135deg, rgba(33,133,213,0.15), rgba(129,140,248,0.10))',
                border: '1px solid rgba(33,133,213,0.25)',
              }}
            >
              <HexLogo />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">ProofWork</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Crea tu cuenta gratis</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Role toggle */}
            <div className="animate-fade-up delay-50">
              <label className="block text-[10.5px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
                Soy
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                {(['Freelancer', 'Recruiter'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setValue('role', role)}
                    className={`
                      py-2 rounded-lg text-sm font-medium transition-all duration-220
                      ${selectedRole === role
                        ? 'text-white shadow-sm'
                        : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                      }
                    `}
                    style={selectedRole === role ? {
                      background: 'linear-gradient(135deg, #2185D5, #818cf8)',
                      boxShadow: '0 2px 12px rgba(33,133,213,0.35)',
                    } : {}}
                  >
                    {role === 'Freelancer' ? 'Freelancer' : 'Reclutador'}
                  </button>
                ))}
              </div>
              {errors.role && <p className="mt-1.5 text-xs text-red-400">{errors.role.message}</p>}
            </div>

            <div className="animate-fade-up delay-100">
              <Input label="Nombre de usuario" placeholder="tu_nombre" error={errors.username?.message} {...register('username')} />
            </div>
            <div className="animate-fade-up delay-150">
              <Input label="Email" type="email" placeholder="tu@email.com" error={errors.email?.message} {...register('email')} />
            </div>
            <div className="animate-fade-up delay-200">
              <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
            </div>
            <div className="animate-fade-up delay-300 pt-1">
              <Button type="submit" className="w-full" loading={loading}>Crear cuenta</Button>
            </div>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="font-semibold text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-200">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
