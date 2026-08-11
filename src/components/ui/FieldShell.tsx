'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { FieldTip } from '@/components/ui/FieldTip';

type FieldShellProps = {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  /** Khóa cấu trúc / disabled — sọc + icon trong ô. */
  locked?: boolean;
  /** AI vừa điền thành công — viền highlight. */
  aiFilled?: boolean;
  children: ReactNode;
  className?: string;
};

function renderLabel(label: string, required?: boolean): ReactNode {
  const match = label.match(/^(.*?)\s*\*\s*$/);
  const text = (match ? match[1] : label).trimEnd();
  const showReq = Boolean(required || match);

  return (
    <>
      {text}
      {showReq ? (
        <span className="ui-field__req" aria-hidden>
          *
        </span>
      ) : null}
    </>
  );
}

/** Icon khóa đỏ — absolute trong ô input / select. */
export function FieldLockIcon({ className }: { className?: string }) {
  return (
    <span
      className={clsx('ui-field__lock-icon', className)}
      title="Khóa — chỉnh ở ngôn ngữ mặc định"
      aria-hidden
    >
      <Lock size={14} strokeWidth={2.4} />
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  locked,
  aiFilled,
  children,
  className,
}: FieldShellProps) {
  return (
    <div
      className={clsx(
        'ui-field',
        error && 'ui-field--invalid',
        locked && 'ui-field--locked',
        aiFilled && 'ui-field--ai-filled',
        className,
      )}
    >
      {label || hint ? (
        <div className="ui-field__label">
          {label ? (
            <label className="ui-field__label-text" htmlFor={htmlFor}>
              {renderLabel(label, required)}
              {aiFilled ? (
                <span className="ui-field__ai-badge" title="AI vừa cập nhật ô này">
                  AI
                </span>
              ) : null}
            </label>
          ) : null}
          {hint ? <FieldTip>{hint}</FieldTip> : null}
        </div>
      ) : null}
      {children}
      {error ? <span className="ui-field__error">{error}</span> : null}
    </div>
  );
}
