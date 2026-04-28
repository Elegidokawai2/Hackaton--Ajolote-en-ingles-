'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface VerificationRequest {
  user_id: string;
  company_name: string;
  rfc: string;
  website: string;
  requested_at: string;
  recruiter_email: string;
}

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVerifications = async () => {
      try {
        const response = await api.get('/admin/verifications');
        setVerifications(response.data.data);
      } catch (error) {
        console.error('Error fetching verifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVerifications();
  }, []);

  const handleVerificationAction = async (userId: string, approved: boolean, rejectionReason?: string) => {
    const action = approved ? 'aprobar' : 'rechazar';
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} esta verificación de empresa?`)) return;

    try {
      await api.put(`/admin/verify-company/${userId}`, {
        approved,
        rejection_reason: rejectionReason
      });

      // Remove from list
      setVerifications(prev => prev.filter(v => v.user_id !== userId));
      alert(`Verificación ${approved ? 'aprobada' : 'rechazada'} exitosamente.`);
    } catch (error) {
      console.error('Error processing verification:', error);
      alert('Error al procesar la verificación.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Verificaciones de Empresa</h1>
        <p className="text-gray-400 mt-1">Revisa solicitudes de verificación de empresas</p>
      </div>

      {/* Verifications List */}
      <div className="space-y-4">
        {verifications.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
            <p className="text-gray-400">No hay solicitudes de verificación pendientes.</p>
          </div>
        ) : (
          verifications.map((verification) => (
            <div key={verification.user_id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400">Empresa</p>
                  <p className="text-white font-medium">{verification.company_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">RFC</p>
                  <p className="text-white">{verification.rfc || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Sitio web</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-white">{verification.website || 'N/A'}</p>
                    {verification.website && (
                      <a
                        href={verification.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Solicitado</p>
                  <p className="text-white">{formatDate(verification.requested_at)}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400">Email del reclutador</p>
                <p className="text-white">{verification.recruiter_email}</p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleVerificationAction(verification.user_id, true)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprobar
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Razón del rechazo (opcional):');
                    handleVerificationAction(verification.user_id, false, reason || undefined);
                  }}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}