'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { ArrowRight, Shield, Zap, Coins } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Glows */}
      <div className="glow-orb w-[500px] h-[500px] bg-[#2185D5] top-[-10%] right-[-5%] opacity-10" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#818cf8] bottom-[10%] left-[-5%] opacity-5" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-[#60b8f0] animate-pulse" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              La nueva era del freelancing en México
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight animate-fade-up delay-100">
            Conecta con talento <span className="gradient-text">verificado</span> on-chain
          </h1>
          
          <p className="text-xl text-white/60 mb-10 leading-relaxed animate-fade-up delay-150">
            Nuup es la plataforma que garantiza pagos seguros con escrow en Stellar y reputación inmutable. 
            Sin intermediarios abusivos, solo talento real y resultados tangibles.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up delay-200">
            <Link href="/auth/register?role=recruiter">
              <Button size="lg" className="h-14 px-8 text-base">
                Publica un reto
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/auth/register?role=freelancer">
              <Button variant="secondary" size="lg" className="h-14 px-8 text-base">
                Encuentra trabajo
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature quick bits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 animate-fade-up delay-300">
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#2185D5]/10 flex items-center justify-center text-[#60b8f0]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Escrow Seguro</h3>
              <p className="text-white/40 text-sm">Fondos protegidos en Stellar</p>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#818cf8]/10 flex items-center justify-center text-[#818cf8]">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Reputación On-Chain</h3>
              <p className="text-white/40 text-sm">Historial verificado e inmutable</p>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#60b8f0]/10 flex items-center justify-center text-[#60b8f0]">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Pagos en MXNe</h3>
              <p className="text-white/40 text-sm">Estabilidad y rapidez local</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
