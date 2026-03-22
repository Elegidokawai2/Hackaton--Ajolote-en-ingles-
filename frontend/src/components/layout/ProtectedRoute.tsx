'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Spinner from '@/components/ui/Spinner';
import api from '@/lib/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'freelancer' | 'recruiter';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, setAuth } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validate = async () => {
      if (!user) {
        // No user in store — try to rehydrate from the httpOnly cookie
        try {
          const res = await api.get('/users/me');
          if (res.data?.user) {
            setAuth({ ...res.data.user, _id: res.data.user._id });
          } else {
            router.push('/auth/login');
            return;
          }
        } catch {
          router.push('/auth/login');
          return;
        }
      }

      // Re-read user after potential hydration
      const currentUser = useAuthStore.getState().user;
      if (requiredRole && currentUser?.role !== requiredRole) {
        router.push('/dashboard');
        return;
      }

      setChecking(false);
    };

    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also handle when user updates after first render
  useEffect(() => {
    if (user && checking) {
      if (requiredRole && user.role !== requiredRole) {
        router.push('/dashboard');
        return;
      }
      setChecking(false);
    }
  }, [user, requiredRole, router, checking]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
