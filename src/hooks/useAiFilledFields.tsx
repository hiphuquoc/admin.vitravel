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

const HOLD_MS = 14_000;

type AiFilledCtx = {
  keys: ReadonlySet<string>;
  mark: (keys: string[]) => void;
  clear: (key?: string) => void;
};

const AiFilledContext = createContext<AiFilledCtx | null>(null);

/** Đánh dấu ô AI vừa điền — highlight tạm + xóa khi user sửa. */
export function AiFilledFieldsProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Set<string>>(() => new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const mark = useCallback((nextKeys: string[]) => {
    clearTimer();
    setKeys(new Set(nextKeys.filter(Boolean)));
    timerRef.current = setTimeout(() => setKeys(new Set()), HOLD_MS);
  }, []);

  const clear = useCallback((key?: string) => {
    if (!key) {
      clearTimer();
      setKeys(new Set());
      return;
    }
    setKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(() => ({ keys, mark, clear }), [keys, mark, clear]);

  return <AiFilledContext.Provider value={value}>{children}</AiFilledContext.Provider>;
}

export function useAiFilled(fieldKey?: string | null): boolean {
  const ctx = useContext(AiFilledContext);
  if (!ctx || !fieldKey) return false;
  return ctx.keys.has(fieldKey);
}

export function useAiFilledActions(): Pick<AiFilledCtx, 'mark' | 'clear'> {
  const ctx = useContext(AiFilledContext);
  return {
    mark: ctx?.mark ?? (() => undefined),
    clear: ctx?.clear ?? (() => undefined),
  };
}
