'use client';

import { Suspense, type ReactNode } from 'react';
import clsx from 'clsx';
import { NavigationLoadingProvider, useNavigationLoading } from '@/lib/navigation-loading';

function ProgressBar() {
  const { isNavigating, progress } = useNavigationLoading();
  const visible = progress != null;
  const finishing = progress === 100;

  return (
    <div
      className={clsx(
        'ui-nav-progress',
        visible && 'ui-nav-progress--visible',
        isNavigating && 'ui-nav-progress--active',
        finishing && 'ui-nav-progress--finishing',
      )}
      aria-hidden={!visible}
      role="presentation"
    >
      <span
        className="ui-nav-progress__bar"
        style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }}
      />
      <span className="ui-nav-progress__glow" aria-hidden />
    </div>
  );
}

function NavigationLoadingRoot({ children }: { children: ReactNode }) {
  return (
    <NavigationLoadingProvider>
      {children}
      <ProgressBar />
    </NavigationLoadingProvider>
  );
}

/**
 * Provider + thanh progress chuyển trang (NProgress-style).
 * Mount bọc children trong Providers (Suspense vì useSearchParams).
 */
export function NavigationProgress({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <NavigationLoadingRoot>{children}</NavigationLoadingRoot>
    </Suspense>
  );
}
