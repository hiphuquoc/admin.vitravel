'use client';

import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
};

/**
 * Loading giữ nguyên kích thước nút (không đổi chữ → “Đang xử lý…”)
 * để tránh nhảy layout sticky footer.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(
        'ui-btn',
        `ui-btn--${variant}`,
        size === 'sm' && 'ui-btn--sm',
        block && 'ui-btn--block',
        loading && 'ui-btn--loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className="ui-btn__body">{children}</span>
      {loading ? (
        <span className="ui-btn__spinner" aria-hidden>
          <Loader2 size={17} className="ui-spin" />
        </span>
      ) : null}
    </button>
  );
}
