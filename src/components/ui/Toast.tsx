'use client';

import clsx from 'clsx';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import toast, { Toaster, resolveValue, type Toast as HotToast } from 'react-hot-toast';

type Tone = 'success' | 'error' | 'loading' | 'info';

function toneFor(type: HotToast['type']): Tone {
  if (type === 'success' || type === 'error' || type === 'loading') return type;
  return 'info';
}

function titleFor(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'Thành công';
    case 'error':
      return 'Có lỗi xảy ra';
    case 'loading':
      return 'Đang xử lý';
    default:
      return 'Thông báo';
  }
}

function iconFor(tone: Tone) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 size={22} strokeWidth={2.2} />;
    case 'error':
      return <AlertCircle size={22} strokeWidth={2.2} />;
    case 'loading':
      return <Loader2 size={22} strokeWidth={2.2} className="ui-toast__spin" />;
    default:
      return <Info size={22} strokeWidth={2.2} />;
  }
}

function ToastCard({ t }: { t: HotToast }) {
  const tone = toneFor(t.type);
  const message = resolveValue(t.message, t);

  return (
    <div
      className={clsx(
        'ui-toast',
        `ui-toast--${tone}`,
        t.visible ? 'ui-toast--in' : 'ui-toast--out',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span className="ui-toast__icon" aria-hidden>
        {iconFor(tone)}
      </span>

      <div className="ui-toast__body">
        <div className="ui-toast__head">
          <p className="ui-toast__title">{titleFor(tone)}</p>
          {t.type !== 'loading' ? (
            <button
              type="button"
              className="ui-toast__close"
              onClick={() => toast.dismiss(t.id)}
              aria-label="Đóng thông báo"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
        <p className="ui-toast__message">{message}</p>
      </div>
    </div>
  );
}

/** Toaster brand — mount 1 lần trong Providers */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerClassName="ui-toast-viewport"
      containerStyle={{
        top: 'calc(var(--admin-topbar-h) + 0.75rem)',
        zIndex: 1200,
      }}
      toastOptions={{
        duration: 4200,
        success: { duration: 3800 },
        error: { duration: 5600 },
        loading: { duration: Infinity },
      }}
    >
      {(t) => <ToastCard t={t} />}
    </Toaster>
  );
}
