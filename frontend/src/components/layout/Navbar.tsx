'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { formatMXN } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import { Menu, X, LogOut, Wallet } from 'lucide-react';
import api from '@/lib/api';

const freelancerLinks = [
  { href: '/events', label: 'Eventos' },
  { href: '/projects', label: 'Proyectos' },
  { href: '/freelancers', label: 'Freelancers' },
  { href: '/wallet', label: 'Wallet' },
];

const recruiterLinks = [
  { href: '/events', label: 'Eventos' },
  { href: '/projects', label: 'Proyectos' },
  { href: '/freelancers', label: 'Talento' },
  { href: '/wallet', label: 'Wallet' },
];

function HexLogo() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300 hover:scale-110">
      <path d="M10 0L19.5 5.5V16.5L10 22L0.5 16.5V5.5L10 0Z" fill="#81DA47" />
      <path d="M10 4L16.5 7.75V15.25L10 19L3.5 15.25V7.75L10 4Z" fill="rgba(9,9,11,0.35)" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const links = user.role === 'recruiter' ? recruiterLinks : freelancerLinks;

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    router.push('/auth/login');
  };

  return (
    <>
      <nav className="navbar-glass fixed top-0 left-0 right-0 h-14 z-40 flex items-center px-4 gap-6">
        {/* Left: Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <HexLogo />
          <span className="text-white font-semibold text-sm tracking-tight group-hover:text-[#81DA47] transition-colors duration-200">ProofWork</span>
        </Link>

        {/* Center: Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white nav-link-active'
                    : 'text-white/45 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Link href="/wallet" className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors duration-150">
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{formatMXN(0)}</span>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-white/5 transition-colors duration-150">
              <div className="relative">
                <Avatar name={user.username} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#81DA47] ring-2 ring-zinc-950" />
              </div>
              <span className="text-white/70 text-xs font-medium hidden lg:block">{user.username}</span>
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1.5 rounded-md hover:bg-white/5"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile: Hamburger */}
        <button
          className="md:hidden ml-auto text-white/60 hover:text-white transition-all duration-150 p-1.5 rounded-md hover:bg-white/5"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 bg-zinc-950/98 z-30 md:hidden animate-fade-in">
          <div className="flex flex-col p-4 gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  pathname.startsWith(link.href)
                    ? 'text-white bg-white/8 border border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-white/5 my-3" />
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="relative">
                <Avatar name={user.username} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#81DA47] ring-2 ring-zinc-950" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{user.username}</p>
                <p className="text-white/40 text-xs">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto text-white/40 hover:text-white transition-all duration-150 p-2 rounded-lg hover:bg-white/5"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
