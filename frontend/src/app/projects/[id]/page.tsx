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
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import ChatBox from '@/components/projects/ChatBox';
import { formatMXN, formatDate } from '@/lib/utils';
import { Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { sileo } from 'sileo';
import type { Project, User as UserType } from '@/types';

const STATUS_STEPS = [
  { key: 'proposed',  label: 'Propuesto' },
  { key: 'active',    label: 'Activo' },
  { key: 'review',    label: 'En revisión' },
  { key: 'completed', label: 'Completado' },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [description, setDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${params.id}`);
      setProject(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchProject(); }, [params.id]);

  const runAction = async (fn: () => Promise<unknown>, msgs: { loading: string; success: string; error: string }) => {
    setActionLoading(true);
    const promise = fn();
    sileo.promise(promise as Promise<unknown>, {
      loading: { title: msgs.loading },
      success: { title: msgs.success },
      error: { title: msgs.error },
    });
    try { await promise; fetchProject(); } catch {}
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

  if (!project) {
    return (
      <ProtectedRoute><Navbar />
        <div className="pt-14 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <p style={{ color: 'var(--text-3)' }}>Proyecto no encontrado</p>
        </div>
      </ProtectedRoute>
    );
  }

  const isFreelancer = typeof project.freelancer_id === 'string'
    ? project.freelancer_id === user?._id
    : (project.freelancer_id as UserType)?._id === user?._id;

  const isRecruiter = typeof project.recruiter_id === 'string'
    ? project.recruiter_id === user?._id
    : (project.recruiter_id as UserType)?._id === user?._id;

  const otherUserId = isFreelancer
    ? (typeof project.recruiter_id === 'string' ? project.recruiter_id : (project.recruiter_id as UserType)?._id)
    : (typeof project.freelancer_id === 'string' ? project.freelancer_id : (project.freelancer_id as UserType)?._id);

  const otherUsername = isFreelancer
    ? (typeof project.recruiter_id === 'object' ? (project.recruiter_id as UserType).username : 'Reclutador')
    : (typeof project.freelancer_id === 'object' ? (project.freelancer_id as UserType).username : 'Freelancer');

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === project.status);

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb w-[500px] h-[500px] -top-32 -right-32 opacity-[0.07]" style={{ background: '#2185D5' }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

            {/* Main — Project info + Chat */}
            <div className="space-y-5">
              {/* Header card */}
              <div className="animate-fade-up rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-white tracking-tight">{project.title}</h1>
                  <Badge variant={getStatusVariant(project.status)}>{undefined}</Badge>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{project.description}</p>
              </div>

              {/* Chat */}
              <div className="animate-fade-up delay-100 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <ChatBox projectId={project._id} otherUserId={otherUserId || ''} otherUsername={otherUsername} />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Details */}
              <div className="animate-fade-up delay-100 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>Detalles</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(33,133,213,0.10)' }}>
                      <DollarSign className="w-3.5 h-3.5 text-[#2185D5]" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Monto en escrow</p>
                      <p className="text-sm font-bold text-white">{formatMXN(project.amount)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.10)' }}>
                      <Calendar className="w-3.5 h-3.5 text-[#4ade80]" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Deadline</p>
                      <p className="text-sm font-semibold text-white">{formatDate(project.deadline)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="animate-fade-up delay-150 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>Progreso</p>
                <div className="space-y-3">
                  {STATUS_STEPS.map((s, i) => {
                    const done = i < currentStepIdx;
                    const current = i === currentStepIdx;
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                          style={{
                            background: done || current
                              ? 'linear-gradient(135deg, #2185D5, #818cf8)'
                              : 'var(--surface-3)',
                            border: current ? '2px solid #60b8f0' : 'none',
                            boxShadow: current ? '0 0 10px rgba(33,133,213,0.5)' : 'none',
                          }}
                        >
                          {done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                          {current && <Clock className="w-3 h-3 text-white" />}
                        </div>
                        <span
                          className={`text-sm ${current ? 'font-semibold text-white' : done ? 'text-white/60' : ''}`}
                          style={!done && !current ? { color: 'var(--text-3)' } : {}}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="animate-fade-up delay-200 rounded-2xl p-5 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Acciones</p>

                {isFreelancer && project.status === 'proposed' && (
                  <Button className="w-full" loading={actionLoading}
                    onClick={() => runAction(() => api.post(`/projects/${params.id}/accept`), {
                      loading: 'Aceptando propuesta...', success: 'Propuesta aceptada', error: 'Error al aceptar',
                    })}>
                    <CheckCircle className="w-4 h-4" /> Aceptar propuesta
                  </Button>
                )}
                {isFreelancer && project.status === 'active' && (
                  <Button className="w-full" onClick={() => setShowDeliverModal(true)}>
                    Subir entrega
                  </Button>
                )}
                {isFreelancer && ['review', 'active'].includes(project.status) && (
                  <Button variant="danger" className="w-full" loading={actionLoading}
                    onClick={() => runAction(() => api.post('/disputes', {
                      project_id: params.id, reason: 'Disputa abierta', description: 'El freelancer ha solicitado revisión',
                    }), { loading: 'Abriendo disputa...', success: 'Disputa abierta', error: 'Error' })}>
                    <AlertTriangle className="w-4 h-4" /> Abrir disputa
                  </Button>
                )}

                {isRecruiter && project.status === 'review' && (
                  <>
                    <Button className="w-full" loading={actionLoading}
                      onClick={() => runAction(() => api.post(`/projects/${params.id}/approve`), {
                        loading: 'Aprobando entrega...', success: 'Pago liberado al freelancer', error: 'Error al aprobar',
                      })}>
                      <CheckCircle className="w-4 h-4" /> Aprobar entrega
                    </Button>
                    {!project.correction_used && (
                      <Button variant="secondary" className="w-full" loading={actionLoading}
                        onClick={() => runAction(() => api.put(`/projects/${params.id}/status`, { status: 'active' }), {
                          loading: 'Actualizando...', success: 'Corrección solicitada', error: 'Error',
                        })}>
                        Solicitar corrección
                      </Button>
                    )}
                    <Button variant="danger" className="w-full" loading={actionLoading}
                      onClick={() => runAction(() => api.put(`/projects/${params.id}/status`, { status: 'rejected' }), {
                        loading: 'Rechazando...', success: 'Proyecto rechazado', error: 'Error',
                      })}>
                      <XCircle className="w-4 h-4" /> Rechazar entrega
                    </Button>
                  </>
                )}

                {project.status === 'completed' && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                    <CheckCircle className="w-4 h-4 text-[#4ade80]" />
                    <span>Proyecto completado</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deliver modal */}
      <Modal open={showDeliverModal} onClose={() => setShowDeliverModal(false)} title="Subir entrega">
        <div className="space-y-4">
          <Input label="URL del archivo" placeholder="https://drive.google.com/…" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          <Textarea label="Descripción" placeholder="Describe tu entrega…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button className="w-full" loading={actionLoading}
            onClick={async () => {
              if (!fileUrl) return;
              setActionLoading(true);
              const p = api.post(`/projects/${params.id}/deliver`, { file_url: fileUrl, description });
              sileo.promise(p, { loading: { title: 'Enviando…' }, success: { title: 'Entrega enviada' }, error: { title: 'Error' } });
              try { await p; setShowDeliverModal(false); fetchProject(); } catch {}
              setActionLoading(false);
            }}>
            Enviar entrega
          </Button>
        </div>
      </Modal>
    </ProtectedRoute>
  );
}
