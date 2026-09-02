'use client';

import { useAuth } from '@/lib/auth-context';

/** Query key có tiền tố project — cache tách theo dự án, tránh hiển thị data dự án trước. */
export function useScopedQueryKey(...parts: unknown[]): unknown[] {
  const { projectCode } = useAuth();
  return [projectCode ?? '_', ...parts];
}
