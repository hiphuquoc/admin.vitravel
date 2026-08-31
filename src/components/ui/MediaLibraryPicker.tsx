'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Images, Loader2, Search, X } from 'lucide-react';
import { mediaApi } from '@/lib/services';
import type { MediaFolder, MediaImage } from '@/lib/types';
import { mediaFolderLabel } from '@/lib/mediaFormat';
import { Button } from '@/components/ui/Button';
import { EntityPagination } from '@/components/ui/EntityList';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (items: MediaImage[]) => void;
  /** Chọn nhiều (gallery) hay 1 ảnh (cover / thay ô). */
  multiple?: boolean;
  maxSelect?: number;
  /** Ảnh đã gắn — không chọn lại. */
  excludeIds?: number[];
  defaultFolder?: MediaFolder | string | null;
  title?: string;
  description?: string;
};

function thumbUrl(item: MediaImage): string | null {
  return item.url_thumb || item.url || item.url_lg || item.url_full || null;
}

export function MediaLibraryPicker({
  open,
  onClose,
  onSelect,
  multiple = true,
  maxSelect = 40,
  excludeIds = [],
  defaultFolder = '',
  title = 'Chọn từ thư viện',
  description = 'Dùng lại ảnh đã tải — không tạo file trùng.',
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState(defaultFolder || '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<number, MediaImage>>(new Map());

  const excluded = useMemo(() => new Set(excludeIds.filter((id) => id > 0)), [excludeIds]);
  const perPage = 24;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSearchInput('');
    setSearch('');
    setFolder(defaultFolder || '');
    setPage(1);
    setSelected(new Map());
  }, [open, defaultFolder]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchInput, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  const listQuery = useQuery({
    queryKey: ['media-library-picker', { search, folder, page, perPage }],
    queryFn: () =>
      mediaApi.library({
        search: search || undefined,
        folder: folder || undefined,
        kind: 'image',
        page,
        per_page: perPage,
      }),
    enabled: open,
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const folders = listQuery.data?.folders ?? [];
  const selectedCount = selected.size;
  const remaining = Math.max(0, maxSelect - selectedCount);

  const toggle = (item: MediaImage) => {
    if (excluded.has(item.id)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        return next;
      }
      if (!multiple) {
        next.clear();
        next.set(item.id, item);
        return next;
      }
      if (next.size >= maxSelect) return prev;
      next.set(item.id, item);
      return next;
    });
  };

  const confirm = () => {
    const picked = [...selected.values()].filter((m) => !excluded.has(m.id));
    if (picked.length === 0) return;
    onSelect(picked.slice(0, maxSelect));
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="ui-modal ui-modal--open ui-media-picker" role="dialog" aria-modal="true">
      <button type="button" className="ui-modal__veil" aria-label="Đóng" onClick={onClose} />
      <div className="ui-modal__card ui-modal__card--form ui-modal__card--wide ui-media-picker__card">
        <header className="ui-modal__head">
          <p className="ui-modal__eyebrow">Thư viện media</p>
          <div className="ui-media-picker__head-row">
            <div>
              <h2 className="ui-modal__title">{title}</h2>
              <p className="ui-modal__desc">{description}</p>
            </div>
            <button type="button" className="ui-media-picker__close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="ui-modal__body ui-media-picker__body">
          <div className="ui-media-picker__toolbar">
            <div className="ui-media-lib__search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                placeholder="Tìm tên file, alt…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
              />
            </div>
            {selectedCount > 0 ? (
              <span className="ui-media-picker__count">
                Đã chọn {selectedCount}
                {multiple ? ` / ${maxSelect}` : ''}
              </span>
            ) : remaining > 0 && multiple ? (
              <span className="ui-media-picker__count">Còn {remaining} chỗ</span>
            ) : null}
          </div>

          <div className="ui-media-lib__folders">
            <button
              type="button"
              className={clsx('ui-media-lib__chip', !folder && 'is-active')}
              onClick={() => {
                setPage(1);
                setFolder('');
              }}
            >
              Tất cả thư mục
            </button>
            {folders.map((f) => (
              <button
                key={f.key}
                type="button"
                className={clsx('ui-media-lib__chip', folder === f.key && 'is-active')}
                onClick={() => {
                  setPage(1);
                  setFolder(f.key);
                }}
                title={
                  f.hidden_from_all
                    ? `${f.path} — chỉ hiện khi chọn thư mục này`
                    : f.path
                }
              >
                {mediaFolderLabel(f.key)}
              </button>
            ))}
          </div>

          {listQuery.isLoading ? (
            <div className="ui-media-picker__state">
              <Loader2 size={20} className="ui-spin" />
              Đang tải thư viện…
            </div>
          ) : items.length === 0 ? (
            <div className="ui-media-picker__state">
              <Images size={26} />
              <strong>Không có ảnh</strong>
              <span>Thử bỏ bộ lọc hoặc tải ảnh mới vào thư viện.</span>
            </div>
          ) : (
            <div className="ui-media-picker__grid">
              {items.map((item) => {
                const thumb = thumbUrl(item);
                const used = excluded.has(item.id);
                const active = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={clsx(
                      'ui-media-picker__tile',
                      active && 'is-active',
                      used && 'is-used',
                    )}
                    disabled={used || (!active && multiple && remaining <= 0)}
                    onClick={() => toggle(item)}
                    onDoubleClick={() => {
                      if (used) return;
                      if (!multiple) {
                        onSelect([item]);
                        onClose();
                      }
                    }}
                    title={used ? 'Ảnh đã có trong gallery' : item.alt || item.filename || ''}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={item.alt || item.filename || ''} loading="lazy" />
                    ) : (
                      <span className="ui-media-picker__tile-fallback">
                        <Images size={18} />
                      </span>
                    )}
                    {used ? <span className="ui-media-picker__badge">Đã dùng</span> : null}
                    {active ? (
                      <span className="ui-media-picker__check" aria-hidden>
                        <Check size={14} strokeWidth={2.6} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <EntityPagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total ?? 0}
            perPage={perPage}
            unitLabel="ảnh"
            loading={listQuery.isLoading}
            onPageChange={setPage}
          />
        </div>

        <footer className="ui-modal__foot">
          <Button type="button" variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="button" disabled={selectedCount === 0} onClick={confirm}>
            {multiple
              ? selectedCount > 0
                ? `Thêm ${selectedCount} ảnh`
                : 'Thêm ảnh'
              : 'Chọn ảnh'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
