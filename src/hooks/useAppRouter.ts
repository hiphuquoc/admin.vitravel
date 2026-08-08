'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationLoading } from '@/lib/navigation-loading';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Router có gắn navigation progress — dùng thay `useRouter` khi push/replace trang.
 */
export function useAppRouter(): AppRouter {
  const router = useRouter();
  const { start } = useNavigationLoading();

  return useMemo(() => {
    const push: AppRouter['push'] = (href, options) => {
      start();
      return router.push(href, options);
    };
    const replace: AppRouter['replace'] = (href, options) => {
      start();
      return router.replace(href, options);
    };
    return { ...router, push, replace };
  }, [router, start]);
}
