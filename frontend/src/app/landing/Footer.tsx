'use client';

import React from 'react';
import Link from 'next/link';
import { Twitter, Github, Linkedin, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="py-12 border-t border-white/5 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <span className="text-white font-bold text-2xl tracking-tight">Nuup</span>
            </Link>
            <p className="text-white/40 max-w-sm mb-6">
              Conectando el talento de México con el mundo a través de tecnología blockchain. 
              Seguridad, transparencia y reputación.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-[#2185D5]/20 transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-[#2185D5]/20 transition-all">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-[#2185D5]/20 transition-all">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Plataforma</h4>
            <ul className="space-y-4">
              <li><Link href="/events" className="text-white/40 hover:text-white text-sm transition-colors">Eventos</Link></li>
              <li><Link href="/projects" className="text-white/40 hover:text-white text-sm transition-colors">Proyectos</Link></li>
              <li><Link href="/freelancers" className="text-white/40 hover:text-white text-sm transition-colors">Freelancers</Link></li>
              <li><Link href="/auth/register" className="text-white/40 hover:text-white text-sm transition-colors">Únete</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Recursos</h4>
            <ul className="space-y-4">
              <li><a href="#" className="text-white/40 hover:text-white text-sm flex items-center gap-1">Stellar Network <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="#" className="text-white/40 hover:text-white text-sm flex items-center gap-1">MXNe Stablecoin <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Documentación</a></li>
              <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Soporte</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:row items-center justify-between gap-4">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} Nuup. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/20 hover:text-white text-xs transition-colors">Privacidad</a>
            <a href="#" className="text-white/20 hover:text-white text-xs transition-colors">Términos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
