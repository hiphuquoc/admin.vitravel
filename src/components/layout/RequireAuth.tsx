'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AdminShell } from '@/components/layout/AdminShell';
import { PageLoader } from '@/components/ui/PageLoader';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
    }
  }, [ready, user, router, pathname]);

  if (!ready) {
    return <PageLoader variant="screen" />;
  }

  if (!user) return null;

  return <AdminShell>{children}</AdminShell>;
}
