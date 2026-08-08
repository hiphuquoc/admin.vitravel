'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export type BlockingProgressPhase = 'running' | 'success' | 'error';

export type BlockingProgressState = {
  open: boolean;
  title: string;
  subtitle?: string;
  detail?: string;
  /** 0–100 */
  percent: number;
  /** Không biết tổng — vòng quay vô định (vẫn hiện %). */
  indeterminate?: boolean;
  phase: BlockingProgressPhase;
};

type ShowOptions = {
  title: string;
  subtitle?: string;
  detail?: string;
  percent?: number;
  indeterminate?: boolean;
};

type UpdateOptions = {
  title?: string;
  subtitle?: string;
  detail?: string;
  percent?: number;
  indeterminate?: boolean;
};

type FinishOptions = {
  title?: string;
  subtitle?: string;
  detail?: string;
  /** ms giữ overlay trước khi tự đóng (mặc định 900). */
  holdMs?: number;
};

export type BlockingProgressApi = {
  state: BlockingProgressState;
  show: (opts: ShowOptions) => void;
  update: (opts: UpdateOptions) => void;
  success: (opts?: FinishOptions) => Promise<void>;
  fail: (opts?: FinishOptions) => Promise<void>;
  close: () => void;
};

const EMPTY: BlockingProgressState = {
  open: false,
  title: '',
  subtitle: undefined,
  detail: undefined,
  percent: 0,
  indeterminate: false,
  phase: 'running',
};

const BlockingProgressContext = createContext<BlockingProgressApi | null>(null);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function BlockingProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BlockingProgressState>(EMPTY);

  const show = useCallback((opts: ShowOptions) => {
    setState({
      open: true,
      title: opts.title,
      subtitle: opts.subtitle,
      detail: opts.detail,
      percent: Math.max(0, Math.min(100, opts.percent ?? 0)),
      indeterminate: !!opts.indeterminate,
      phase: 'running',
    });
  }, []);

  const update = useCallback((opts: UpdateOptions) => {
    setState((prev) => {
      if (!prev.open) return prev;
      return {
        ...prev,
        title: opts.title ?? prev.title,
        subtitle: opts.subtitle === undefined ? prev.subtitle : opts.subtitle,
        detail: opts.detail === undefined ? prev.detail : opts.detail,
        percent:
          opts.percent === undefined
            ? prev.percent
            : Math.max(0, Math.min(100, opts.percent)),
        indeterminate:
          opts.indeterminate === undefined ? prev.indeterminate : opts.indeterminate,
        phase: 'running',
      };
    });
  }, []);

  const close = useCallback(() => setState(EMPTY), []);

  const success = useCallback(
    async (opts?: FinishOptions) => {
      setState((prev) => ({
        ...prev,
        open: true,
        phase: 'success',
        percent: 100,
        indeterminate: false,
        title: opts?.title ?? prev.title,
        subtitle: opts?.subtitle === undefined ? prev.subtitle : opts.subtitle,
        detail: opts?.detail === undefined ? prev.detail : opts.detail,
      }));
      await sleep(opts?.holdMs ?? 900);
      setState(EMPTY);
    },
    [],
  );

  const fail = useCallback(async (opts?: FinishOptions) => {
    setState((prev) => ({
      ...prev,
      open: true,
      phase: 'error',
      indeterminate: false,
      title: opts?.title ?? 'Thao tác thất bại',
      subtitle: opts?.subtitle === undefined ? prev.subtitle : opts.subtitle,
      detail: opts?.detail === undefined ? prev.detail : opts.detail,
    }));
    await sleep(opts?.holdMs ?? 1600);
    setState(EMPTY);
  }, []);

  const api = useMemo(
    () => ({ state, show, update, success, fail, close }),
    [state, show, update, success, fail, close],
  );

  return (
    <BlockingProgressContext.Provider value={api}>
      {children}
      <BlockingProgressOverlay state={state} />
    </BlockingProgressContext.Provider>
  );
}

export function useBlockingProgress(): BlockingProgressApi {
  const ctx = useContext(BlockingProgressContext);
  if (!ctx) {
    throw new Error('useBlockingProgress must be used within BlockingProgressProvider');
  }
  return ctx;
}

function BlockingProgressOverlay({ state }: { state: BlockingProgressState }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!state.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [state.open]);

  if (!mounted || !state.open) return null;

  const pct = Math.round(state.percent);
  const ring = 2 * Math.PI * 54;
  const dash = state.indeterminate && state.phase === 'running' ? ring * 0.28 : (pct / 100) * ring;

  return createPortal(
    <div
      className={clsx(
        'ui-blocking-progress',
        `ui-blocking-progress--${state.phase}`,
        state.open && 'ui-blocking-progress--open',
      )}
      role="alertdialog"
      aria-modal="true"
      aria-busy={state.phase === 'running'}
      aria-labelledby="ui-blocking-progress-title"
      aria-describedby="ui-blocking-progress-detail"
    >
      <div className="ui-blocking-progress__veil" aria-hidden />
      <div className="ui-blocking-progress__card">
        <div className="ui-blocking-progress__glow" aria-hidden />

        <div
          className={clsx(
            'ui-blocking-progress__ring-wrap',
            state.indeterminate &&
              state.phase === 'running' &&
              'ui-blocking-progress__ring-wrap--spin',
          )}
        >
          <svg className="ui-blocking-progress__ring" viewBox="0 0 120 120" aria-hidden>
            <circle className="ui-blocking-progress__ring-track" cx="60" cy="60" r="54" />
            <circle
              className="ui-blocking-progress__ring-value"
              cx="60"
              cy="60"
              r="54"
              style={{
                strokeDasharray: `${dash} ${ring}`,
              }}
            />
          </svg>
          <div className="ui-blocking-progress__ring-center">
            {state.phase === 'running' ? (
              <span className="ui-blocking-progress__pct">
                {state.indeterminate ? <Loader2 size={28} className="ui-spin" /> : `${pct}%`}
              </span>
            ) : state.phase === 'success' ? (
              <CheckCircle2 size={36} strokeWidth={2} className="ui-blocking-progress__done-icon" />
            ) : (
              <XCircle size={36} strokeWidth={2} className="ui-blocking-progress__fail-icon" />
            )}
          </div>
        </div>

        <h2 id="ui-blocking-progress-title" className="ui-blocking-progress__title">
          {state.title}
        </h2>
        {state.subtitle ? (
          <p className="ui-blocking-progress__subtitle">{state.subtitle}</p>
        ) : null}

        <div className="ui-blocking-progress__bar" aria-hidden>
          <div
            className={clsx(
              'ui-blocking-progress__bar-fill',
              state.indeterminate &&
                state.phase === 'running' &&
                'ui-blocking-progress__bar-fill--pulse',
            )}
            style={{ width: state.indeterminate && state.phase === 'running' ? '40%' : `${pct}%` }}
          />
        </div>

        <p id="ui-blocking-progress-detail" className="ui-blocking-progress__detail">
          {state.detail || (state.phase === 'running' ? 'Vui lòng giữ tab mở…' : '\u00a0')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
