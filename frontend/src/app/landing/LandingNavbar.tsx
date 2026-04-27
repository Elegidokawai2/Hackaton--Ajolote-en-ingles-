'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Button from '@/components/ui/Button';

function HexLogo() {
  return (
    <svg width="22" height="24" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300 group-hover:scale-110">
      <defs>
        <linearGradient id="hexGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2185D5" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="url(#hexGrad)" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { name: 'Cómo funciona', href: '#how-it-works' },
    { name: 'Características', href: '#features' },
    { name: 'Testimonios', href: '#testimonials' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16 ${
        scrolled ? 'navbar-glass py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <HexLogo />
          <span className="text-white font-bold text-xl tracking-tight transition-colors duration-200 group-hover:text-[#60b8f0]">
            Nuup
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              {link.name}
            </a>
          ))}
          <div className="flex items-center gap-3 ml-4">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Iniciar Sesión</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm">Regístrate</Button>
            </Link>
          </div>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#050508] border-b border-white/10 p-6 md:hidden animate-fade-in">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-white/70 hover:text-white text-lg font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <hr className="border-white/10" />
            <div className="flex flex-col gap-3">
              <Link href="/auth/login" className="w-full">
                <Button variant="secondary" className="w-full">Iniciar Sesión</Button>
              </Link>
              <Link href="/auth/register" className="w-full">
                <Button className="w-full">Regístrate</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
