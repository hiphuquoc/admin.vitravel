import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/layout/RequireAuth';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
