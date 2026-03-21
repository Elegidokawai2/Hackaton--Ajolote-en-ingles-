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
  role: z.enum(['freelancer', 'recruiter'], { required_error: 'Selecciona un rol' }),
});

type RegisterForm = z.infer<typeof registerSchema>;

function HexLogo() {
  return (
    <svg width="36" height="40" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="#81DA47" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'freelancer' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);

    try {
      const registerPromise = api.post('/auth/register', data);
      sileo.promise(registerPromise, {
        loading: { title: 'Creando cuenta...' },
        success: { title: 'Cuenta creada' },
        error: { title: 'Error al crear cuenta' },
      });
      await registerPromise;

      const loginRes = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      });
      setAuth(loginRes.data);
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
      {/* Decorative bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #81DA47, transparent)' }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #81DA47, transparent)' }} />
      </div>

      <div className="animate-scale-in bg-white rounded-2xl border border-black/[0.06] p-8 w-full max-w-sm relative"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex flex-col items-center mb-7">
          <div className="p-3 rounded-2xl bg-zinc-950 mb-4"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <HexLogo />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">ProofWork</h1>
          <p className="text-sm text-zinc-500 mt-1">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Role Toggle */}
          <div className="animate-fade-up delay-50">
            <label className="block text-[10.5px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Soy
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
              <button
                type="button"
                onClick={() => setValue('role', 'freelancer')}
                className={`py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedRole === 'freelancer'
                    ? 'bg-white text-zinc-900 shadow-sm border border-black/[0.06]'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Freelancer
              </button>
              <button
                type="button"
                onClick={() => setValue('role', 'recruiter')}
                className={`py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedRole === 'recruiter'
                    ? 'bg-white text-zinc-900 shadow-sm border border-black/[0.06]'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Reclutador
              </button>
            </div>
            {errors.role && <p className="mt-1.5 text-xs text-red-500">{errors.role.message}</p>}
          </div>

          <div className="animate-fade-up delay-100">
            <Input
              label="Nombre de usuario"
              placeholder="tu_nombre"
              error={errors.username?.message}
              {...register('username')}
            />
          </div>
          <div className="animate-fade-up delay-150">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="animate-fade-up delay-200">
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
          <div className="animate-fade-up delay-300">
            <Button type="submit" className="w-full mt-1" loading={loading}>
              Crear cuenta
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-zinc-900 font-semibold hover:text-[#6bc438] transition-colors duration-150">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
