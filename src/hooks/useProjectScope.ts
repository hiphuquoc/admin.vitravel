'use client';

import { useCallback } from 'react';
import { getProjectCode } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** Dự án đang chọn trên UI (auth state + localStorage fallback). */
export function useActiveProjectCode(): string | null {
  const { projectCode } = useAuth();
  return projectCode ?? getProjectCode();
}

export function requireActiveProjectCode(code: string | null | undefined): string {
  const resolved = code ?? getProjectCode();
  if (!resolved) {
    throw new Error('Chưa chọn dự án');
  }
  return resolved;
}

/**
 * Bắt buộc dùng trong mutationFn của form theo dự án — luôn gửi X-Project-Code từ UI hiện tại,
 * không phụ thuộc scoped query đang fetch song song.
 */
export function useProjectMutationScope() {
  const activeProjectCode = useActiveProjectCode();

  const withProject = useCallback(
    <T>(fn: (projectCode: string) => Promise<T>): Promise<T> => {
      const code = requireActiveProjectCode(activeProjectCode);
      return fn(code);
    },
    [activeProjectCode],
  );

  return { activeProjectCode, withProject, requireProject: requireActiveProjectCode };
}

/** Kiểm tra response API có khớp dự án user đang chọn không. */
export function assertProjectResponse(
  expectedCode: string | null | undefined,
  response: { code?: string | null } | null | undefined,
): boolean {
  if (!expectedCode || !response?.code) return true;
  return response.code === expectedCode;
}
