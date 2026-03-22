'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { formatMXN, formatRelative } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import { Menu, X, LogOut, Wallet, Bell } from 'lucide-react';
import api from '@/lib/api';
import type { Notification } from '@/types';

const freelancerLinks = [
  { href: '/events', label: 'Eventos' },
  { href: '/projects', label: 'Proyectos' },
  { href: '/freelancers', label: 'Freelancers' },
  { href: '/wallet', label: 'Wallet' },
];

const recruiterLinks = [
  { href: '/events', label: 'Eventos' },
  { href: '/projects', label: 'Proyectos' },
  { href: '/freelancers', label: 'Talentos' },
  { href: '/wallet', label: 'Wallet' },
];

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

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/wallets/balance')
      .then((res) => setBalance(res.data.balance_mxne ?? 0))
      .catch(() => setBalance(0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = () => {
      api.get('/notifications')
        .then((res) => {
          // API returns { notifications: [...], unread_count: N, pagination: {...} }
          const data = res.data;
          if (data && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          } else if (Array.isArray(data)) {
            // fallback: plain array (shouldn't happen but safety net)
            setNotifications(data);
          }
        })
        .catch(() => { });
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const links = user.role === 'recruiter' ? recruiterLinks : freelancerLinks;
  const unread = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { }
    logout();
    router.push('/auth/login');
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { }
  };

  return (
    <>
      <nav
        className={`navbar-glass backdrop-blur-sm fixed top-0 left-0 right-0 h-14 z-40 transition-all duration-300 ${scrolled ? 'shadow-[0_4px_40px_rgba(0,0,0,0.5)]' : ''
          }`}
      >
        <div className="max-w-6xl mx-auto h-full px-4 grid grid-cols-3 items-center">

          {/* LEFT: Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 w-fit group">
            <HexLogo />
            <span className="text-white font-semibold text-md tracking-tight transition-colors duration-200 group-hover:text-[#60b8f0]">
              Nuup
            </span>
          </Link>

          {/* CENTER: Nav links – truly centered via grid */}
          <div className="hidden md:flex items-center justify-center gap-1">
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    relative px-3.5 py-1.5 rounded-lg text-[13px] font-medium
                    transition-colors duration-200
                    ${isActive
                      ? 'text-white nav-link-active'
                      : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
                    }
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* RIGHT: Actions */}
          <div className="hidden md:flex items-center justify-end gap-2">
            {/* Balance */}
            <Link
              href="/wallet"
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                text-white/45 hover:text-white/90
                hover:bg-white/[0.05]
                transition-all duration-200
              "
            >
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs font-medium tabular-nums">
                {balance !== null ? formatMXN(balance) : '···'}
              </span>
            </Link>

            <div className="w-px h-4 bg-white/[0.07]" />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="
                  relative p-2 rounded-lg
                  text-white/40 hover:text-white/80
                  hover:bg-white/[0.06]
                  transition-all duration-200
                "
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="
                    absolute -top-0.5 -right-0.5
                    min-w-[15px] h-[15px]
                    bg-[#2185D5] text-white text-[9px] font-bold
                    rounded-full flex items-center justify-center px-[3px]
                    animate-glow
                  ">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="
                  absolute right-0 top-11
                  w-80 max-h-96
                  bg-[#0e0e14] border border-white/[0.08]
                  rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)]
                  overflow-hidden z-50 flex flex-col
                  animate-slide-down
                ">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    <span className="text-sm font-semibold text-white">Notificaciones</span>
                    {unread > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-150 font-medium"
                      >
                        Marcar leídas
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-8">Sin notificaciones</p>
                    ) : (
                      notifications.slice(0, 15).map((n) => (
                        <button
                          key={n._id}
                          onClick={() => handleMarkRead(n._id)}
                          className={`
                            w-full text-left px-4 py-3
                            border-b border-white/[0.04] last:border-0
                            transition-colors duration-200
                            hover:bg-white/[0.04]
                            ${!n.read ? 'bg-[rgba(33,133,213,0.06)]' : ''}
                          `}
                        >
                          <div className="flex items-start gap-2.5">
                            {!n.read && (
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2185D5] shrink-0 shadow-[0_0_6px_#2185D5]" />
                            )}
                            <div className={!n.read ? '' : 'pl-4'}>
                              <p className="text-xs font-semibold text-white/90">{n.title}</p>
                              <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-white/25 mt-1">{formatRelative(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-white/[0.07]" />

            {/* Avatar + username */}
            <div className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-white/[0.05] transition-colors duration-200">
              <div className="relative">
                <Avatar name={user.username} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#050508] online-dot" />
              </div>
              <span className="text-white/55 text-xs font-medium hidden lg:block">{user.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* MOBILE: Hamburger */}
          <div className="md:hidden flex justify-end col-span-2">
            <button
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 bg-[#050508]/97 z-30 md:hidden animate-fade-in backdrop-blur-xl">
          <div className="flex flex-col p-4 gap-1">
            {links.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  animate-fade-up px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${pathname.startsWith(link.href)
                    ? 'text-white bg-[rgba(33,133,213,0.15)] border border-[rgba(33,133,213,0.25)]'
                    : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                  }
                `}
                style={{ animationDelay: `${i * 55}ms` }}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-white/[0.05] my-3" />
            <div className="flex items-center gap-3 px-4 py-2 animate-fade-up delay-300">
              <div className="relative">
                <Avatar name={user.username} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#050508] online-dot" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{user.username}</p>
                <p className="text-white/35 text-xs capitalize">{user.role}</p>
                {balance !== null && (
                  <p className="text-[#60b8f0] text-xs font-medium tabular-nums">{formatMXN(balance)}</p>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto text-white/35 hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/[0.05]"
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
