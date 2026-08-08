import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Badge({
  children,
  tone = 'neutral',
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  /** Khi có — badge thành nút bật/tắt trạng thái. */
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const className = clsx('ui-badge', `ui-badge--${tone}`, onClick && 'ui-badge--toggle');

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        title={title}
      >
        {children}
      </button>
    );
  }

  return <span className={className}>{children}</span>;
}

export function PageHeader({
  eyebrow,
  id,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  id?: string | number | null;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-page-header" aria-label={title}>
      <div className="ui-page-header__atmosphere" aria-hidden>
        <div className="ui-page-header__spine" />
        <div className="ui-page-header__sky" />
        <div className="ui-page-header__ribbon ui-page-header__ribbon--a" />
        <div className="ui-page-header__ribbon ui-page-header__ribbon--b" />
        <div className="ui-page-header__spark" />
        <svg
          className="ui-page-header__topo"
          viewBox="0 0 640 280"
          preserveAspectRatio="xMaxYMid slice"
          focusable="false"
        >
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--1"
            d="M120 220C220 180 280 90 400 78C500 68 560 110 640 96"
          />
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--2"
            d="M80 250C200 210 300 130 420 118C520 108 580 150 640 140"
          />
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--3"
            d="M160 190C250 160 320 70 440 56C540 44 590 78 640 66"
          />
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--4"
            d="M200 160C290 140 350 50 470 40C560 32 600 58 640 48"
          />
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--accent ui-page-header__topo-line--5"
            d="M40 268C170 230 290 150 430 132C530 118 590 168 640 158"
          />
          <path
            className="ui-page-header__topo-line ui-page-header__topo-line--accent ui-page-header__topo-line--6"
            d="M100 205C210 175 300 95 450 82C545 72 595 105 640 92"
          />
        </svg>
        <div className="ui-page-header__signal" />
      </div>

      <div className="ui-page-header__inner">
        <div className="ui-page-header__top">
          <div className="ui-page-header__copy">
            {eyebrow || (id != null && id !== '') ? (
              <div className="ui-page-header__meta">
                {eyebrow ? <span className="ui-page-header__badge">{eyebrow}</span> : null}
                {id != null && id !== '' ? (
                  <span className="ui-page-header__id">
                    <span className="ui-page-header__id-pulse" aria-hidden />
                    <span className="ui-page-header__id-label">ID</span>
                    <span className="ui-page-header__id-val">#{id}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <h1 className="ui-page-header__title">{title}</h1>
            {description ? <p className="ui-page-header__desc">{description}</p> : null}
          </div>
          {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon" aria-hidden>
        ◇
      </div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

export function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'published' || status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  if (status === 'archived') return 'neutral';
  return 'neutral';
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    published: 'Xuất bản',
    draft: 'Nháp',
    archived: 'Lưu trữ',
  };
  return map[status] || status;
}

export function formatMoney(value: string | number | null | undefined, currency = 'VND'): string {
  if (value == null || value === '') return '—';
  const amount = Math.round(Number(value)).toLocaleString('en-US');
  return currency === 'VND' ? `${amount}₫` : `${amount} ${currency}`;
}
