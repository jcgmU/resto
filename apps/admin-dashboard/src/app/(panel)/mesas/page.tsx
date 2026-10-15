"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPage from '../dashboard/page';

export default function MesasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return <DashboardPage />;
}
