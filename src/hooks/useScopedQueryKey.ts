'use client';

import type { QueryFunctionContext } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { projectFromScopedKey, runWithProjectScope } from '@/lib/apiScope';

/** Query key có tiền tố project — cache tách theo dự án, tránh hiển thị data dự án trước. */
export function useScopedQueryKey(...parts: unknown[]): unknown[] {
  const { projectCode } = useAuth();
  return [projectCode ?? '_', ...parts];
}

/**
 * Bọc queryFn: gắn X-Project-Code theo queryKey[0], không đọc localStorage lúc fetch.
 * Bắt buộc dùng với useScopedQueryKey.
 */
export function createScopedQueryFn<T>(
  fn: (ctx: { signal: AbortSignal }) => Promise<T>,
) {
  return ({ queryKey, signal }: QueryFunctionContext<readonly unknown[]>) => {
    const projectCode = projectFromScopedKey(queryKey);
    return runWithProjectScope(projectCode, () => fn({ signal }));
  };
}
