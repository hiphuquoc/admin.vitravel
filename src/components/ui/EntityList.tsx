'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export function EntityList({
  children,
  loading,
  empty,
}: {
  children: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
}) {
  if (loading) {
    return (
      <div className="entity-list entity-list--loading" aria-busy>
        <div className="ui-skeleton" />
      </div>
    );
  }

  if (empty) {
    return <div className="entity-list entity-list--empty">{empty}</div>;
  }

  return <div className="entity-list">{children}</div>;
}

export function EntityRow({
  children,
  className,
  media,
}: {
  children: ReactNode;
  className?: string;
  /** When true, first column expects EntityThumb — full-height media rail */
  media?: boolean;
}) {
  return (
    <article className={clsx('entity-row', media && 'entity-row--media', className)}>
      {children}
    </article>
  );
}

export function EntityThumb({
  src,
  alt = '',
  href,
}: {
  src?: string | null;
  alt?: string;
  href?: string;
}) {
  const className = clsx('entity-thumb', !src && 'entity-thumb--empty');
  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" />
  ) : (
    <span className="entity-thumb__empty" aria-hidden />
  );

  if (href) {
    return (
      <Link href={href} className={className} title={alt || undefined}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function EntityMain({
  title,
  href,
  slug,
  publicHref,
  badges,
  facts,
  children,
}: {
  title: string;
  href?: string;
  slug?: string | null;
  /** Open public page when clicking the slug chip */
  publicHref?: string | null;
  badges?: ReactNode;
  facts?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="entity-main">
      <div className="entity-main__head">
        {href ? (
          <Link href={href} className="entity-main__title">
            {title}
          </Link>
        ) : (
          <span className="entity-main__title">{title}</span>
        )}
        {badges ? <div className="entity-main__badges">{badges}</div> : null}
      </div>
      {slug ? (
        publicHref ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="entity-main__slug entity-main__slug--link"
            title={`Mở trang public: ${slug}`}
          >
            <span className="entity-main__slug-label">URL</span>
            <code>{slug}</code>
          </a>
        ) : (
          <div className="entity-main__slug" title={slug}>
            <span className="entity-main__slug-label">URL</span>
            <code>{slug}</code>
          </div>
        )
      ) : null}
      {facts ? <div className="entity-facts">{facts}</div> : null}
      {children}
    </div>
  );
}

export function EntityFact({
  label,
  children,
  accent,
}: {
  label?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={clsx('entity-fact', accent && 'entity-fact--accent')}>
      {label ? <span className="entity-fact__label">{label}</span> : null}
      <span className="entity-fact__value">{children}</span>
    </div>
  );
}

/** Giá / số liệu — typography only, không khung border */
export function EntityHighlight({
  label,
  children,
  tone = 'price',
}: {
  label?: string;
  children: ReactNode;
  tone?: 'price' | 'stat' | 'neutral';
}) {
  return (
    <div className={clsx('entity-highlight', `entity-highlight--${tone}`)}>
      {label ? <span className="entity-highlight__label">{label}</span> : null}
      <span className="entity-highlight__value">{children}</span>
    </div>
  );
}

/** Box action — nút 1 dòng (icon + nhãn), xếp dọc bên phải row */
export function EntityActions({
  editHref,
  onDelete,
  deleteLabel = 'Xóa',
  editLabel = 'Sửa',
  children,
}: {
  editHref?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  editLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="entity-actions" role="group" aria-label="Thao tác">
      {children}
      {editHref ? (
        <Link href={editHref} className="entity-actions__btn entity-actions__btn--edit" title={editLabel}>
          <span className="entity-actions__icon" aria-hidden>
            <Pencil size={15} strokeWidth={2.1} />
          </span>
          <span className="entity-actions__label">{editLabel}</span>
        </Link>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="entity-actions__btn entity-actions__btn--danger"
          title={deleteLabel}
          onClick={onDelete}
        >
          <span className="entity-actions__icon" aria-hidden>
            <Trash2 size={15} strokeWidth={2.1} />
          </span>
          <span className="entity-actions__label">{deleteLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

export const LIST_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_LIST_PER_PAGE = 20;

/** Thanh count · số/trang · pager — dùng chung mọi trang list */
export function EntityPagination({
  page,
  lastPage,
  total = 0,
  perPage,
  unitLabel = 'mục',
  loading,
  className,
  onPageChange,
  onPerPageChange,
  /** @deprecated dùng onPageChange */
  onPrev,
  /** @deprecated dùng onPageChange */
  onNext,
}: {
  page: number;
  lastPage: number;
  total?: number;
  perPage: number;
  unitLabel?: string;
  loading?: boolean;
  className?: string;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const safeLast = Math.max(1, lastPage || 1);
  const safePage = Math.min(Math.max(1, page), safeLast);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);

  const go = (next: number) => {
    if (onPageChange) onPageChange(next);
    else if (next < safePage) onPrev?.();
    else if (next > safePage) onNext?.();
  };

  return (
    <div className={clsx('ui-list-meta', className)} aria-label="Điều khiển danh sách">
      <p className="ui-list-meta__count">
        {loading ? (
          <span className="ui-list-meta__loading">Đang tải…</span>
        ) : total > 0 ? (
          <>
            <strong>
              {from}–{to}
            </strong>
            <span className="ui-list-meta__of">trong</span>
            <strong>{total}</strong>
            <span className="ui-list-meta__unit">{unitLabel}</span>
          </>
        ) : (
          <strong>0 {unitLabel}</strong>
        )}
      </p>

      <div className="ui-list-meta__controls">
        {onPerPageChange ? (
          <label className="ui-list-meta__per">
            <span className="ui-list-meta__a11y">Số mục mỗi trang</span>
            <select
              value={perPage}
              disabled={loading}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              aria-label="Số mục mỗi trang"
            >
              {LIST_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}/trang
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="ui-list-meta__pager" aria-label="Chuyển trang">
          <button
            type="button"
            className="ui-list-meta__nav"
            disabled={loading || safePage <= 1}
            onClick={() => go(Math.max(1, safePage - 1))}
            aria-label="Trang trước"
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </button>
          <span className="ui-list-meta__page">
            Trang <strong>{loading ? '—' : safePage}</strong>
            <span className="ui-list-meta__of">/</span>
            <strong>{loading ? '—' : safeLast}</strong>
          </span>
          <button
            type="button"
            className="ui-list-meta__nav"
            disabled={loading || safePage >= safeLast}
            onClick={() => go(Math.min(safeLast, safePage + 1))}
            aria-label="Trang sau"
          >
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>
        </nav>
      </div>
    </div>
  );
}
