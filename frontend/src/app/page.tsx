'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Spinner from '@/components/ui/Spinner';
import LandingNavbar from './landing/LandingNavbar';
import Hero from './landing/Hero';
import HowItWorks from './landing/HowItWorks';
import Features from './landing/Features';
import SocialProof from './landing/SocialProof';
import Footer from './landing/Footer';

export default function HomePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    } else {
      setLoading(false);
    }
  }, [user, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508]">
      <LandingNavbar />
      <Hero />
      <HowItWorks />
      <Features />
      <SocialProof />
      <Footer />
    </main>
  );
}
