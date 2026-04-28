'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import { formatMXN, formatDate } from '@/lib/utils';
import { ArrowLeft, User, MessageSquare, FileText, Send } from 'lucide-react';

interface DisputeDetail {
  dispute: {
    _id: string;
    project_id: {
      title: string;
      freelancer_id: string;
      recruiter_id: string;
      agreed_amount: number;
      deadline: string;
      description: string;
    };
    opened_by: {
      username: string;
      email: string;
    };
    reason: string;
    description: string;
    status: string;
    resolution?: string;
    admin_reasoning?: string;
    created_at: string;
  };
  evidence: Array<{
    _id: string;
    user_id: {
      username: string;
    };
    content: string;
    file_url?: string;
    created_at: string;
  }>;
}

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ruling, setRuling] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchDispute = async () => {
      try {
        const response = await api.get(`/disputes/${params.id}`);
        setDispute(response.data.data);
      } catch (error) {
        console.error('Error fetching dispute:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchDispute();
    }
  }, [params.id]);

  const handleSubmitRuling = async () => {
    if (!ruling || !reasoning.trim()) {
      alert('Por favor selecciona un fallo y proporciona una razón.');
      return;
    }

    if (!confirm('¿Confirmas esta resolución? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/admin/disputes/${params.id}/resolve`, {
        ruling,
        reasoning: reasoning.trim()
      });

      alert('Disputa resuelta exitosamente.');
      router.push('/admin/disputes');
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Error al resolver la disputa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="text-center text-gray-400">
        Disputa no encontrada
      </div>
    );
  }

  const { dispute: disputeData, evidence } = dispute;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Detalle de Disputa</h1>
          <p className="text-gray-400 mt-1">Proyecto: {disputeData.project_id.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Summary */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Resumen del Proyecto</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Monto acordado</p>
                <p className="text-lg font-semibold text-white">
                  {formatMXN(disputeData.project_id.agreed_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Fecha límite</p>
                <p className="text-lg font-semibold text-white">
                  {formatDate(disputeData.project_id.deadline)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-400">Descripción</p>
              <p className="text-white mt-1">{disputeData.project_id.description}</p>
            </div>
          </div>

          {/* Dispute Details */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Detalles de la Disputa</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Abierta por</p>
                <p className="text-white">{disputeData.opened_by.username} ({disputeData.opened_by.email})</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Razón</p>
                <p className="text-white">{disputeData.reason}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Descripción</p>
                <p className="text-white">{disputeData.description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Fecha de apertura</p>
                <p className="text-white">{formatDate(disputeData.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Evidencia Presentada</h2>
            {evidence.length === 0 ? (
              <p className="text-gray-400">No se ha presentado evidencia aún.</p>
            ) : (
              <div className="space-y-4">
                {evidence.map((item) => (
                  <div key={item._id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{item.user_id.username}</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="text-white">{item.content}</p>
                    {item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                      >
                        <FileText className="w-4 h-4 inline mr-1" />
                        Ver archivo
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Ruling Form */}
        <div className="space-y-6">
          {disputeData.status === 'pending' ? (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Resolver Disputa</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fallo
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ruling"
                        value="freelancer"
                        checked={ruling === 'freelancer'}
                        onChange={(e) => setRuling(e.target.value)}
                        className="text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-white">Favor del freelancer</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ruling"
                        value="recruiter"
                        checked={ruling === 'recruiter'}
                        onChange={(e) => setRuling(e.target.value)}
                        className="text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-white">Favor del reclutador</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ruling"
                        value="partial_50"
                        checked={ruling === 'partial_50'}
                        onChange={(e) => setRuling(e.target.value)}
                        className="text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-white">Distribución parcial (50% cada uno)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Razón de la decisión
                  </label>
                  <textarea
                    value={reasoning}
                    onChange={(e) => setReasoning(e.target.value)}
                    placeholder="Explica tu razonamiento para esta resolución..."
                    rows={6}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmitRuling}
                  disabled={submitting || !ruling || !reasoning.trim()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {submitting ? (
                    <Spinner />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Resolver Disputa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Disputa Resuelta</h2>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Fallo</p>
                <p className="text-white capitalize">
                  {disputeData.resolution === 'freelancer' ? 'Favor del freelancer' :
                   disputeData.resolution === 'recruiter' ? 'Favor del reclutador' :
                   disputeData.resolution?.startsWith('partial_') ? `Distribución parcial (${disputeData.resolution.split('_')[1]}%)` :
                   disputeData.resolution}
                </p>
                <p className="text-sm text-gray-400 mt-4">Razonamiento</p>
                <p className="text-white">{disputeData.admin_reasoning}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}