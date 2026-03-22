'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Badge, { getStatusVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Modal from '@/components/ui/Modal';
import { formatMXN, formatDate } from '@/lib/utils';
import { Calendar, Users, Trophy, ExternalLink, CheckCircle } from 'lucide-react';
import { sileo } from 'sileo';
import type { Event, EventSubmission, EventParticipant, Category, User as UserType } from '@/types';

export default function EventDetailPage() {
  const params = useParams();
  const { user } = useAuthStore();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [description, setDescription] = useState('');

  const fetchAll = async () => {
    try {
      const [eventRes, partRes, subRes] = await Promise.allSettled([
        api.get(`/events/${params.id}`),
        api.get(`/events/${params.id}/participants`),
        api.get(`/events/${params.id}/submissions`),
      ]);
      if (eventRes.status === 'fulfilled') setEvent(eventRes.value.data);
      if (partRes.status === 'fulfilled') setParticipants(Array.isArray(partRes.value.data) ? partRes.value.data : []);
      if (subRes.status === 'fulfilled') setSubmissions(Array.isArray(subRes.value.data) ? subRes.value.data : []);
    } catch { setEvent(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [params.id]);

  const handleApply = async () => {
    setApplying(true);
    const promise = api.post(`/events/${params.id}/apply`);
    sileo.promise(promise, {
      loading: { title: 'Aplicando…' },
      success: { title: 'Registrado al evento' },
      error: { title: 'Error al aplicar' },
    });
    try { await promise; fetchAll(); } catch {}
    setApplying(false);
  };

  const handleSubmitWork = async () => {
    if (!fileUrl) return;
    setSubmitting(true);
    const promise = api.post(`/events/${params.id}/submit`, { file_url: fileUrl, description });
    sileo.promise(promise, {
      loading: { title: 'Enviando entrega…' },
      success: { title: 'Entrega registrada' },
      error: { title: 'Error al enviar' },
    });
    try { await promise; setShowSubmitModal(false); setFileUrl(''); setDescription(''); fetchAll(); } catch {}
    setSubmitting(false);
  };

  const handleSelectWinner = async (submissionId: string) => {
    const promise = api.post(`/events/${params.id}/winner`, { submission_ids: [submissionId] });
    sileo.promise(promise, {
      loading: { title: 'Seleccionando ganador…' },
      success: { title: 'Ganador seleccionado', description: 'Premio liberado desde Soroban' },
      error: { title: 'Error al seleccionar ganador' },
    });
    try { await promise; fetchAll(); } catch {}
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

  if (!event) {
    return (
      <ProtectedRoute><Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <p style={{ color: 'var(--text-3)' }}>Evento no encontrado</p>
        </div>
      </ProtectedRoute>
    );
  }

  const categoryName = typeof event.category_id === 'object' ? (event.category_id as Category).name : 'General';
  const recruiterName = typeof event.recruiter_id === 'object' ? (event.recruiter_id as UserType).username : 'Reclutador';
  const isOwner = typeof event.recruiter_id === 'object'
    ? (event.recruiter_id as UserType)._id === user?._id
    : event.recruiter_id === user?._id;

  const alreadyApplied = participants.some((p) => {
    const fId = typeof p.freelancer_id === 'object' ? (p.freelancer_id as UserType)._id : p.freelancer_id;
    return fId === user?._id;
  });

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-40 -right-40 opacity-[0.07]" style={{ background: '#2185D5' }} />
          <div className="glow-orb w-[400px] h-[400px] -bottom-32 -left-32 opacity-[0.06]" style={{ background: '#818cf8' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

            {/* Main */}
            <div className="space-y-5">
              {/* Event header */}
              <div className="animate-fade-up rounded-2xl p-5 overflow-hidden relative" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #2185D5, #818cf8)' }} />
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(33,133,213,0.10)', color: '#60b8f0', border: '1px solid rgba(33,133,213,0.18)' }}
                  >
                    {categoryName}
                  </span>
                  <Badge variant={getStatusVariant(event.status)}>{undefined}</Badge>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight mb-3">{event.title}</h1>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{event.description}</p>
              </div>

              {/* Participants (owner only) */}
              {isOwner && participants.length > 0 && (
                <div className="animate-fade-up delay-100 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold text-white mb-4">Participantes ({participants.length})</h2>
                  <div className="space-y-2">
                    {participants.map((p) => {
                      const pUser = typeof p.freelancer_id === 'object' ? p.freelancer_id as UserType : null;
                      const uname = pUser?.username || 'Freelancer';
                      return (
                        <div key={p._id} className="list-item flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2 pl-2">
                            <Avatar name={uname} size="sm" />
                            <span className="text-sm text-white">{uname}</span>
                          </div>
                          <Badge variant={p.status === 'winner' ? 'completed' : p.status === 'submitted' ? 'review' : 'pending'}>
                            {p.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submissions */}
              {(isOwner || user?.role === 'freelancer') && submissions.length > 0 && (
                <div className="animate-fade-up delay-150 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold text-white mb-4">Entregas ({submissions.length})</h2>
                  <div className="space-y-3">
                    {submissions.map((sub) => {
                      const subUser = typeof sub.freelancer_id === 'object' ? sub.freelancer_id as UserType : null;
                      const uname = subUser?.username || 'Freelancer';
                      return (
                        <div key={sub._id} className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={uname} size="sm" />
                              <span className="text-sm font-medium text-white">{uname}</span>
                            </div>
                            {sub.is_winner && (
                              <div className="flex items-center gap-1 text-xs font-semibold text-[#60b8f0]">
                                <Trophy className="w-3.5 h-3.5" /> Ganador
                              </div>
                            )}
                          </div>
                          {sub.description && (
                            <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{sub.description}</p>
                          )}
                          {sub.file_url && (
                            <a
                              href={sub.file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-150"
                            >
                              <ExternalLink className="w-3 h-3" /> Ver entrega
                            </a>
                          )}
                          {isOwner && event.status === 'active' && !sub.is_winner && (
                            <div className="mt-3">
                              <Button variant="secondary" className="w-full text-xs" onClick={() => handleSelectWinner(sub._id)}>
                                <CheckCircle className="w-3.5 h-3.5" /> Seleccionar ganador
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="animate-fade-up delay-50 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* Prize hero */}
                <div
                  className="p-5 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(33,133,213,0.12) 0%, rgba(129,140,248,0.08) 100%)' }}
                >
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #2185D5, transparent)', filter: 'blur(20px)' }} />
                  <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Premio</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{formatMXN(event.prize_amount)}</p>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} />
                    <div>
                      <p className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: 'var(--text-3)' }}>Cierre</p>
                      <p className="text-white font-medium">{formatDate(event.deadline_submission)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Trophy className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} />
                    <div>
                      <p className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: 'var(--text-3)' }}>Ganadores</p>
                      <p className="text-white font-medium">{event.max_winners} ganador{event.max_winners > 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} />
                    <div>
                      <p className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: 'var(--text-3)' }}>Participantes</p>
                      <p className="text-white font-medium">{participants.length} registrados</p>
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                    Por: <span className="text-white font-medium">{recruiterName}</span>
                  </div>

                  <hr style={{ borderColor: 'var(--border)' }} />

                  {/* Freelancer CTA */}
                  {user?.role === 'freelancer' && event.status === 'active' && (
                    <div className="space-y-2">
                      {!alreadyApplied ? (
                        <Button className="w-full" onClick={handleApply} loading={applying}>Participar ahora</Button>
                      ) : (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                          <CheckCircle className="w-4 h-4 text-[#4ade80]" /> Ya estás participando
                        </div>
                      )}
                      {alreadyApplied && (
                        <Button variant="secondary" className="w-full" onClick={() => setShowSubmitModal(true)}>
                          Subir entrega
                        </Button>
                      )}
                    </div>
                  )}

                  {isOwner && event.soroban_event_id && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${event.soroban_event_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-[#60b8f0] hover:text-[#2185D5] transition-colors duration-150"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver on-chain
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit work modal */}
      <Modal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Subir entrega">
        <div className="space-y-4">
          <Input label="URL del archivo" placeholder="https://drive.google.com/…" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          <Textarea label="Descripción" placeholder="Describe tu entrega…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button className="w-full" onClick={handleSubmitWork} loading={submitting}>Enviar entrega</Button>
        </div>
      </Modal>
    </ProtectedRoute>
  );
}
