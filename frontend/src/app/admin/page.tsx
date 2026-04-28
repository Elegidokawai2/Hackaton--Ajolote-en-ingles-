'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import { formatMXN } from '@/lib/utils';
import {
  Users,
  UserCheck,
  Building,
  AlertTriangle,
  Calendar,
  Wallet,
  TrendingUp,
  Activity
} from 'lucide-react';

interface StatsData {
  kpis: {
    total_users: number;
    active_freelancers: number;
    active_recruiters: number;
    total_mxne_in_escrow: number;
    disputes_pending: number;
    events_live: number;
  };
  charts: {
    user_registrations_last_30_days: Array<{
      _id: string;
      count: number;
    }>;
  };
  recent_activity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/stats');
        setStats(response.data.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-400">
        Error loading dashboard data
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Total Usuarios',
      value: stats.kpis.total_users,
      icon: Users,
      color: 'text-blue-400'
    },
    {
      title: 'Freelancers Activos',
      value: stats.kpis.active_freelancers,
      icon: UserCheck,
      color: 'text-green-400'
    },
    {
      title: 'Reclutadores Activos',
      value: stats.kpis.active_recruiters,
      icon: Building,
      color: 'text-purple-400'
    },
    {
      title: 'MXNe en Escrow',
      value: formatMXN(stats.kpis.total_mxne_in_escrow),
      icon: Wallet,
      color: 'text-yellow-400'
    },
    {
      title: 'Disputas Pendientes',
      value: stats.kpis.disputes_pending,
      icon: AlertTriangle,
      color: 'text-red-400'
    },
    {
      title: 'Eventos Activos',
      value: stats.kpis.events_live,
      icon: Calendar,
      color: 'text-indigo-400'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Administrativo</h1>
        <p className="text-gray-400 mt-1">Resumen general de la plataforma</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <div key={index} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">{kpi.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
              </div>
              <kpi.icon className={`w-8 h-8 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registrations Chart */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Registros de Usuarios (30 días)</h3>
          </div>
          <div className="space-y-2">
            {stats.charts.user_registrations_last_30_days.slice(-7).map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{day._id}</span>
                <div className="flex items-center">
                  <div
                    className="bg-blue-600 h-2 rounded mr-2"
                    style={{ width: `${Math.min(day.count * 10, 100)}px` }}
                  />
                  <span className="text-sm text-white">{day.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <Activity className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Actividad Reciente</h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats.recent_activity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}