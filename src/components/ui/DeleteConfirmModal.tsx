'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { adminPath } from '@/lib/api';
import type { DeleteImpact } from '@/lib/types';

type Target = {
  id: number;
  title: string;
};

type Props = {
  open: boolean;
  target: Target | null;
  impact: DeleteImpact | null;
  loadingImpact?: boolean;
  busy?: boolean;
  entityLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Modal xác nhận xóa — liệt kê trang đang liên kết (đồng bộ ui-modal). */
export function DeleteConfirmModal({
  open,
  target,
  impact,
  loadingImpact = false,
  busy = false,
  entityLabel = 'mục',
  onCancel,
  onConfirm,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, busy, onCancel]);

  if (!mounted || !open || !target) return null;

  const linkedCount = impact?.linked_count ?? 0;
  const groups = impact?.groups ?? [];

  return createPortal(
    <div
      className={clsx('ui-modal', 'ui-modal--open', 'ui-delete-confirm')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-delete-confirm-title"
    >
      <button
        type="button"
        className="ui-modal__veil"
        aria-label="Đóng"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="ui-modal__card ui-modal__card--form ui-delete-confirm__card">
        <header className="ui-modal__head">
          <p className="ui-modal__eyebrow">Xóa {entityLabel}</p>
          <h2 id="ui-delete-confirm-title" className="ui-modal__title ui-delete-confirm__title">
            Xác nhận xóa «{target.title}»?
          </h2>
          <p className="ui-modal__desc">
            {loadingImpact
              ? 'Đang kiểm tra trang liên kết…'
              : impact?.warning ||
                `Xóa ${entityLabel} này? Thao tác không hoàn tác được.`}
          </p>
        </header>

        <div className="ui-modal__body">
          {loadingImpact ? (
            <p className="ui-delete-confirm__loading">Đang tải danh sách liên kết…</p>
          ) : linkedCount > 0 ? (
            <div className="ui-delete-confirm__groups">
              {groups.map((group) => (
                <section key={group.key} className="ui-delete-confirm__group">
                  <header className="ui-delete-confirm__group-head">
                    <h3 className="ui-delete-confirm__group-title">
                      {group.label}
                      <span className="ui-delete-confirm__count">{group.total}</span>
                    </h3>
                    {group.action_hint ? (
                      <p className="ui-delete-confirm__group-hint">{group.action_hint}</p>
                    ) : null}
                  </header>
                  <ul className="ui-delete-confirm__list">
                    {group.items.map((item) => (
                      <li key={`${group.key}-${item.id}`} className="ui-delete-confirm__item">
                        <div className="ui-delete-confirm__item-main">
                          <span className="ui-delete-confirm__item-title">{item.title}</span>
                          {item.slug ? (
                            <span className="ui-delete-confirm__item-slug">{item.slug}</span>
                          ) : null}
                        </div>
                        {item.admin_href ? (
                          <Link
                            href={adminPath(item.admin_href)}
                            className="ui-delete-confirm__item-link"
                            target="_blank"
                            rel="noreferrer"
                            title="Mở trang admin"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={14} />
                            <span>Mở</span>
                          </Link>
                        ) : null}
                      </li>
                    ))}
                    {group.total > group.items.length ? (
                      <li className="ui-delete-confirm__more">
                        … và {group.total - group.items.length} mục khác
                      </li>
                    ) : null}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="ui-delete-confirm__empty">Không có trang đang liên kết tới mục này.</p>
          )}
        </div>

        <footer className="ui-modal__foot">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={busy}
            disabled={loadingImpact}
            onClick={onConfirm}
          >
            {linkedCount > 0 ? 'Xác nhận xóa & gỡ liên kết' : 'Xác nhận xóa'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
