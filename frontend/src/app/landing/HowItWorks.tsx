'use client';

import React from 'react';
import { UserPlus, Briefcase, CheckCircle, Search, Rocket, Star } from 'lucide-react';

export default function HowItWorks() {
  const recruiterSteps = [
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: 'Publica un reto',
      desc: 'Define los requisitos, el presupuesto y las fechas de entrega.'
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: 'Selecciona talento',
      desc: 'Evalúa portafolios con reputación on-chain verificada.'
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: 'Libera el pago',
      desc: 'El pago se libera automáticamente al validar la entrega.'
    }
  ];

  const freelancerSteps = [
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: 'Crea tu perfil',
      desc: 'Registra tu wallet y empieza a construir tu reputación.'
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: 'Aplica a proyectos',
      desc: 'Participa en eventos y gana proyectos según tu nivel.'
    },
    {
      icon: <Rocket className="w-6 h-6" />,
      title: 'Gana y crece',
      desc: 'Recibe pagos en MXNe y sube de nivel en el ranking.'
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-white mb-4">¿Cómo funciona Nuup?</h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            Un ecosistema diseñado para la transparencia y eficiencia en el trabajo remoto.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Recruiters */}
          <div className="space-y-10">
            <h3 className="text-2xl font-semibold text-[#60b8f0] flex items-center gap-3">
              Para Reclutadores
            </h3>
            <div className="space-y-8">
              {recruiterSteps.map((step, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
                    {step.icon}
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-lg mb-1">{step.title}</h4>
                    <p className="text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Freelancers */}
          <div className="space-y-10">
            <h3 className="text-2xl font-semibold text-[#818cf8] flex items-center gap-3">
              Para Freelancers
            </h3>
            <div className="space-y-8">
              {freelancerSteps.map((step, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
                    {step.icon}
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-lg mb-1">{step.title}</h4>
                    <p className="text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
