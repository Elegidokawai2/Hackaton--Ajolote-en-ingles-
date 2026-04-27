'use client';

import React from 'react';
import { Lock, Globe, Cpu, Zap, CreditCard, BarChart3 } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Escrow Descentralizado',
      desc: 'Los fondos se bloquean en un contrato inteligente y solo se liberan cuando el trabajo es aprobado.'
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Ecosistema Stellar',
      desc: 'Aprovechamos la red Stellar para transacciones globales, rápidas y con comisiones casi nulas.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Reputación Inmutable',
      desc: 'Cada proyecto completado y cada reseña se guarda on-chain, creando un currículum imposible de falsificar.'
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: 'Pagos en MXNe',
      desc: 'Evita la volatilidad con la stablecoin del peso mexicano, lista para ser convertida a fiat.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Contratos 1:1 y Retos',
      desc: 'Desde contrataciones directas hasta eventos de competencia para encontrar al mejor candidato.'
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: 'Tecnología Soroban',
      desc: 'Smart contracts de última generación que garantizan la lógica de negocio sin fallos.'
    }
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-white mb-4">Tecnología que genera confianza</h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            Eliminamos la incertidumbre del trabajo remoto con herramientas de Web3 diseñadas para el mundo real.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="card p-8 group hover:border-[#2185D5]/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#2185D5]/5 flex items-center justify-center text-[#60b8f0] mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
