'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { formatMXN, formatDate, truncateAddress } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Lock, Unlock, Copy, Wallet } from 'lucide-react';
import { sileo } from 'sileo';
import type { Wallet as WalletType, Transaction } from '@/types';

const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  deposit:  { icon: <ArrowDownLeft className="w-4 h-4" />, label: 'Depósito',    color: '#4ade80' },
  withdraw: { icon: <ArrowUpRight  className="w-4 h-4" />, label: 'Retiro',      color: '#f87171' },
  escrow:   { icon: <Lock          className="w-4 h-4" />, label: 'Escrow',      color: '#fbbf24' },
  release:  { icon: <Unlock        className="w-4 h-4" />, label: 'Liberación',  color: '#60b8f0' },
};

export default function WalletPage() {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      const [walletRes, txRes] = await Promise.allSettled([
        api.get('/wallets'),
        api.get('/wallets/transactions'),
      ]);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data);
      if (txRes.status === 'fulfilled')
        setTransactions(Array.isArray(txRes.value.data) ? txRes.value.data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchWallet(); }, []);

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return;
    setActionLoading(true);
    const promise = api.post('/wallets/deposit', { amount_mxn: amount, amount_mxne: amount });
    sileo.promise(promise, {
      loading: { title: 'Procesando depósito...' },
      success: { title: 'Depósito exitoso', description: `${formatMXN(amount)} MXNe acreditados` },
      error:   { title: 'Error al depositar' },
    });
    try { await promise; setDepositAmount(''); await fetchWallet(); } catch {}
    setActionLoading(false);
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return;
    setActionLoading(true);
    const promise = api.post('/wallets/withdraw', { amount_mxne: amount, external_address: withdrawAddress || undefined });
    sileo.promise(promise, {
      loading: { title: 'Procesando retiro...' },
      success: { title: 'Retiro exitoso', description: `${formatMXN(amount)} MXNe retirados` },
      error:   { title: 'Error al retirar' },
    });
    try { await promise; setWithdrawAmount(''); setWithdrawAddress(''); await fetchWallet(); } catch {}
    setActionLoading(false);
  };

  if (loading) {
    return (
      <ProtectedRoute><Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <Spinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* BG orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-32 -right-32 opacity-[0.08]" style={{ background: '#2185D5' }} />
          <div className="glow-orb w-[400px] h-[400px] -bottom-24 -left-24 opacity-[0.06]" style={{ background: '#818cf8' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          <div className="animate-fade-up mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Finanzas
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Wallet</h1>
          </div>

          {/* Balance hero */}
          <div
            className="animate-fade-up delay-50 rounded-2xl p-px mb-6 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(33,133,213,0.5), rgba(129,140,248,0.3), rgba(255,255,255,0.04))' }}
          >
            <div
              className="rounded-[calc(1rem-1px)] p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0c0c18 0%, #0f0f22 100%)' }}
            >
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #2185D5, transparent)', filter: 'blur(40px)' }} />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-[#60b8f0]" />
                    <p className="text-[10.5px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Saldo on-chain</p>
                  </div>

                  {wallet?.on_chain_balances && wallet.on_chain_balances.length > 0 ? (
                    <div className="space-y-2">
                      {wallet.on_chain_balances.map((b, i) => (
                        <div key={i} className="flex items-baseline gap-2">
                          <p className="text-4xl font-bold text-white tabular-nums leading-none">
                            {parseFloat(b.balance).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 7 })}
                          </p>
                          <span className="text-sm font-semibold text-[#60b8f0]">{b.asset_code || b.asset_type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-4xl font-bold text-white tabular-nums leading-none mb-1">0.00</p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sin fondos · La cuenta no ha sido activada en Stellar Network</p>
                    </div>
                  )}

                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>Stellar Network · {process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet'}</p>
                </div>
                {wallet?.stellar_address && (
                  <button
                    onClick={() => navigator.clipboard.writeText(wallet.stellar_address)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-white/[0.05]"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }}
                    title="Copiar dirección"
                  >
                    <span className="font-mono text-xs">{truncateAddress(wallet.stellar_address, 8)}</span>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Deposit / Withdraw */}
          <div className="animate-fade-up delay-100 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Deposit */}
            <div className="card p-5" style={{ background: 'var(--surface)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.12)' }}>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#4ade80]" />
                </div>
                <h3 className="text-sm font-semibold text-white">Depositar</h3>
              </div>
              <div className="space-y-3">
                <Input label="Monto (MXN)" type="number" placeholder="1000" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                <Button className="w-full" onClick={handleDeposit} loading={actionLoading} disabled={!depositAmount || Number(depositAmount) <= 0}>
                  Depositar fondos
                </Button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="card p-5" style={{ background: 'var(--surface)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#f87171]" />
                </div>
                <h3 className="text-sm font-semibold text-white">Retirar</h3>
              </div>
              <div className="space-y-3">
                <Input label="Monto (MXNe)" type="number" placeholder="500" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                <Input label="CLABE / Dirección (opcional)" placeholder="012345…" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
                <Button variant="secondary" className="w-full" onClick={handleWithdraw} loading={actionLoading} disabled={!withdrawAmount || Number(withdrawAmount) <= 0}>
                  Retirar a cuenta
                </Button>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="animate-fade-up delay-200 card p-5" style={{ background: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold text-white mb-5">Historial de transacciones</h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>Sin transacciones aún</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx) => {
                  const cfg = typeConfig[tx.type] ?? { icon: null, label: tx.type, color: 'var(--text-2)' };
                  const isPositive = tx.type === 'deposit' || tx.type === 'release';
                  return (
                    <div
                      key={tx._id}
                      className="list-item flex items-center justify-between p-3 rounded-xl"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-3 pl-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${cfg.color}18`, color: cfg.color }}
                        >
                          {cfg.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{cfg.label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums" style={{ color: isPositive ? '#4ade80' : '#f87171' }}>
                          {isPositive ? '+' : '-'}{formatMXN(tx.amount_mxn)}
                        </p>
                        <Badge variant={tx.status === 'completed' ? 'completed' : tx.status === 'pending' ? 'pending' : 'rejected'}>
                          {tx.status === 'completed' ? 'Completado' : tx.status === 'pending' ? 'Pendiente' : 'Fallido'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
