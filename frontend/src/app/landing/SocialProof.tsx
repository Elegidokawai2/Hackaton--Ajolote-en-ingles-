'use client';

import React from 'react';
import { Quote } from 'lucide-react';

export default function SocialProof() {
  const testimonials = [
    {
      text: "Nuup cambió la forma en que contratamos. La reputación on-chain nos da la seguridad que ninguna otra plataforma ofrece.",
      author: "Roberto G.",
      role: "CTO en TechMexico"
    },
    {
      text: "Como freelancer, lo que más valoro es el escrow. Sé que mi dinero está seguro desde que empiezo el reto.",
      author: "Ana L.",
      role: "Fullstack Developer"
    },
    {
      text: "La rapidez de los pagos en MXNe es increíble. Por fin una plataforma que entiende el mercado mexicano.",
      author: "Carlos M.",
      role: "UI/UX Designer"
    }
  ];

  return (
    <section id="testimonials" className="py-24 bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Lo que dicen de nosotros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="glass-panel p-8 rounded-2xl relative">
              <Quote className="absolute top-6 right-8 w-8 h-8 text-white/5" />
              <p className="text-white/70 italic mb-6 leading-relaxed">"{t.text}"</p>
              <div>
                <p className="text-white font-semibold">{t.author}</p>
                <p className="text-white/30 text-xs">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder Logos */}
        <div className="mt-20 pt-10 border-t border-white/5">
          <p className="text-center text-white/20 text-sm uppercase tracking-widest mb-10">Confían en nosotros</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-30 grayscale contrast-125">
             <div className="text-2xl font-bold text-white">TECH-CO</div>
             <div className="text-2xl font-bold text-white">MEX-DEV</div>
             <div className="text-2xl font-bold text-white">SOLUTIONS</div>
             <div className="text-2xl font-bold text-white">WEB3-HUB</div>
             <div className="text-2xl font-bold text-white">BLOCK-MEX</div>
          </div>
        </div>
      </div>
    </section>
  );
}
