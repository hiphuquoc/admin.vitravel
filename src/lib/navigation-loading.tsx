'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getBasePath } from '@/lib/api';

type NavigationLoadingContextValue = {
  /** Đang chuyển trang (sau debounce ngắn). */
  isNavigating: boolean;
  /** 0–100 — thanh progress; null khi ẩn. */
  progress: number | null;
  /** Bắt đầu indicator ngay khi click / router.push. */
  start: () => void;
  /** Kết thúc (pathname đổi hoặc huỷ). */
  done: () => void;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

function normalizePath(pathname: string, search = ''): string {
  const base = getBasePath().replace(/\/$/, '') || '';
  let path = pathname || '/';
  if (base && path.startsWith(base)) {
    path = path.slice(base.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const qs = search.startsWith('?') ? search : search ? `?${search}` : '';
  return `${path}${qs}`;
}

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

type Phase = 'idle' | 'running' | 'finishing';

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const stopTick = useCallback(() => {
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
  }, []);

  const beginRunning = useCallback(() => {
    setProgress(12);
    setPhaseSafe('running');
    stopTick();
    // Tiến dần về ~78% — không nhảy vòng (tránh cảm giác giật)
    tickTimer.current = setInterval(() => {
      setProgress((prev) => {
        const cur = prev ?? 12;
        if (cur >= 78) return cur;
        const step = cur < 40 ? 6 : cur < 60 ? 3.2 : 1.4;
        return Math.min(78, cur + step);
      });
    }, 280);
  }, [setPhaseSafe, stopTick]);

  const done = useCallback(() => {
    pendingRef.current = false;
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
    stopTick();

    // Chưa kịp hiện bar (nav rất nhanh) → tắt im
    if (phaseRef.current === 'idle') {
      setProgress(null);
      return;
    }

    setPhaseSafe('finishing');
    setProgress(100);
    finishTimer.current = setTimeout(() => {
      setPhaseSafe('idle');
      setProgress(null);
      finishTimer.current = null;
    }, 320);
  }, [setPhaseSafe, stopTick]);

  const start = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    clearTimers();
    setPhaseSafe('idle');
    setProgress(null);

    // Debounce — tránh nháy khi hover/click nhầm trang cùng URL
    showTimer.current = setTimeout(() => {
      if (pendingRef.current) beginRunning();
    }, 120);

    safetyTimer.current = setTimeout(() => {
      if (pendingRef.current) done();
    }, 12_000);
  }, [beginRunning, clearTimers, done, setPhaseSafe]);

  // Kết thúc khi URL App Router đổi
  useEffect(() => {
    if (!pendingRef.current && phaseRef.current === 'idle') return undefined;
    const t = setTimeout(() => done(), 90);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi route đổi
  }, [routeKey]);

  // Bắt click Link nội bộ — phản hồi ngay trước khi RSC load
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e) || e.defaultPrevented) return;
      const el = e.target as Element | null;
      const anchor = el?.closest?.('a');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const hrefAttr = anchor.getAttribute('href');
      if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) {
        return;
      }

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = normalizePath(url.pathname, url.search);
      const current = normalizePath(window.location.pathname, window.location.search);
      if (next === current) return;

      start();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const isNavigating = phase === 'running' || phase === 'finishing';

  useEffect(() => {
    document.documentElement.classList.toggle('is-navigating', phase === 'running');
    return () => document.documentElement.classList.remove('is-navigating');
  }, [phase]);

  const value = useMemo(
    () => ({ isNavigating, progress, start, done }),
    [isNavigating, progress, start, done],
  );

  return (
    <NavigationLoadingContext.Provider value={value}>{children}</NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) {
    return {
      isNavigating: false,
      progress: null,
      start: () => undefined,
      done: () => undefined,
    } satisfies NavigationLoadingContextValue;
  }
  return ctx;
}
