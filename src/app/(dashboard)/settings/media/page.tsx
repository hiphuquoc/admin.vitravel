'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Check,
  Copy,
  ExternalLink,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  Search,
  Trash2,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from '@/lib/toast';
import { mediaApi } from '@/lib/services';
import type { MediaFolder, MediaImage } from '@/lib/types';
import {
  formatBytes,
  formatMediaDate,
  isMediaFolder,
  mediaFolderLabel,
} from '@/lib/mediaFormat';
import { Input, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { HeadActions, HeadCta } from '@/components/ui/HeadActions';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityPagination,
} from '@/components/ui/EntityList';

type KindFilter = 'all' | 'image' | 'video';

function previewUrl(item: MediaImage | null | undefined): string | null {
  if (!item) return null;
  return item.url_thumb || item.url || item.url_lg || item.url_full || null;
}

function fullUrl(item: MediaImage | null | undefined): string | null {
  if (!item) return null;
  return item.url_full || item.url_lg || item.url || item.url_thumb || null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Đã sao chép URL');
  } catch {
    toast.error('Không sao chép được');
  }
}

/** Nút icon vuông có viền — màu theo tính năng. */
function MediaIconBtn({
  tone = 'neutral',
  label,
  title,
  onClick,
  href,
  disabled,
  children,
}: {
  tone?: 'neutral' | 'view' | 'copy' | 'open' | 'danger';
  label?: string;
  title?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = clsx('ui-media-icon-btn', `ui-media-icon-btn--${tone}`);
  const tip = title || label;
  const body = (
    <>
      <span className="ui-media-icon-btn__glyph" aria-hidden>
        {children}
      </span>
      {label ? <span className="ui-media-icon-btn__label">{label}</span> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={tip}
        aria-label={tip}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={tip}
      aria-label={tip}
      onClick={onClick}
      disabled={disabled}
    >
      {body}
    </button>
  );
}

function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const item = items[index];
  const src = fullUrl(item);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, index - 1));
      if (e.key === 'ArrowRight') onIndexChange(Math.min(items.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, index, items.length, onClose, onIndexChange]);

  if (!mounted || !item) return null;

  return createPortal(
    <div className="ui-media-lightbox" role="dialog" aria-modal="true" aria-label="Xem full media">
      <button type="button" className="ui-media-lightbox__veil" aria-label="Đóng" onClick={onClose} />

      <div className="ui-media-lightbox__shell">
        <header className="ui-media-lightbox__top">
          <div className="ui-media-lightbox__top-copy">
            <span className="ui-media-lightbox__count">
              {index + 1} / {items.length}
            </span>
            <strong>{item.filename || `Media #${item.id}`}</strong>
            <small>
              {item.width && item.height ? `${item.width}×${item.height}` : '—'}
              {' · '}
              {formatBytes(item.size_bytes)}
              {' · '}
              {mediaFolderLabel(item.folder)}
            </small>
          </div>
          <div className="ui-media-lightbox__top-actions">
            {src ? (
              <>
                <MediaIconBtn tone="copy" label="Copy" onClick={() => void copyText(src)}>
                  <Copy size={16} strokeWidth={2.15} />
                </MediaIconBtn>
                <MediaIconBtn tone="open" label="Mở" href={src}>
                  <ExternalLink size={16} strokeWidth={2.15} />
                </MediaIconBtn>
              </>
            ) : null}
            <MediaIconBtn tone="neutral" label="Đóng" onClick={onClose}>
              <X size={16} strokeWidth={2.15} />
            </MediaIconBtn>
          </div>
        </header>

        <div className="ui-media-lightbox__canvas">
          {index > 0 ? (
            <button
              type="button"
              className="ui-media-lightbox__nav ui-media-lightbox__nav--prev"
              onClick={() => onIndexChange(index - 1)}
              aria-label="Trước"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          {index < items.length - 1 ? (
            <button
              type="button"
              className="ui-media-lightbox__nav ui-media-lightbox__nav--next"
              onClick={() => onIndexChange(index + 1)}
              aria-label="Sau"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}

          <div className="ui-media-lightbox__frame">
            {item.kind === 'video' && src ? (
              <video src={src} controls playsInline autoPlay className="ui-media-lightbox__media" />
            ) : src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={item.alt || item.filename || ''}
                className="ui-media-lightbox__media"
              />
            ) : (
              <div className="ui-media-lightbox__empty">Không có URL xem được</div>
            )}
          </div>
        </div>

        {(item.alt || item.path) && (
          <footer className="ui-media-lightbox__foot">
            {item.alt ? <p>{item.alt}</p> : null}
            {item.path ? <code>{item.path}</code> : null}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

function MediaDetailDrawer({
  item,
  altDraft,
  creditDraft,
  onAltChange,
  onCreditChange,
  onClose,
  onOpenFull,
  onSave,
  saving,
  onDelete,
  deleting,
}: {
  item: MediaImage;
  altDraft: string;
  creditDraft: string;
  onAltChange: (v: string) => void;
  onCreditChange: (v: string) => void;
  onClose: () => void;
  onOpenFull: () => void;
  onSave: () => void;
  saving: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const src = fullUrl(item);
  const thumb = previewUrl(item);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="ui-media-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết media">
      <button type="button" className="ui-media-drawer__veil" aria-label="Đóng" onClick={onClose} />

      <aside className="ui-media-drawer__panel">
        <header className="ui-media-drawer__head">
          <span className="ui-media-drawer__head-icon" aria-hidden>
            <ImageIcon size={16} strokeWidth={2.15} />
          </span>
          <div className="ui-media-drawer__head-copy">
            <p className="ui-media-drawer__kicker">Chi tiết media · #{item.id}</p>
            <h2 title={item.filename || undefined}>{item.filename || `Media #${item.id}`}</h2>
          </div>
          <button
            type="button"
            className="ui-media-drawer__close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="ui-media-drawer__body">
          <button type="button" className="ui-media-drawer__hero" onClick={onOpenFull}>
            {item.kind === 'video' && src ? (
              <video src={src} muted playsInline />
            ) : thumb || src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src || thumb!} alt={item.alt || item.filename || ''} />
            ) : (
              <span className="ui-media-drawer__hero-empty">Không có preview</span>
            )}
            <span className="ui-media-drawer__hero-hint">
              <Maximize2 size={13} /> Xem full
            </span>
          </button>

          <section className="ui-media-drawer__section">
            <h3>Thông tin file</h3>
            <ul className="ui-media-drawer__facts">
              <li>
                <span>Kích thước</span>
                <strong>
                  {item.width && item.height ? `${item.width} × ${item.height} px` : '—'}
                </strong>
              </li>
              <li>
                <span>Dung lượng</span>
                <strong>{formatBytes(item.size_bytes)}</strong>
              </li>
              <li>
                <span>MIME</span>
                <strong>{item.mime_type || '—'}</strong>
              </li>
              <li>
                <span>Thư mục</span>
                <strong>{mediaFolderLabel(item.folder)}</strong>
              </li>
              <li>
                <span>Disk</span>
                <strong>{item.disk || '—'}</strong>
              </li>
              <li>
                <span>Variants</span>
                <strong>{item.has_variants ? 'thumb / card / lg' : 'Không'}</strong>
              </li>
              <li>
                <span>Tạo lúc</span>
                <strong>{formatMediaDate(item.created_at)}</strong>
              </li>
              <li>
                <span>Cập nhật</span>
                <strong>{formatMediaDate(item.updated_at)}</strong>
              </li>
              <li className="ui-media-drawer__facts--wide">
                <span>Path</span>
                <strong title={item.path || undefined}>{item.path || '—'}</strong>
              </li>
            </ul>
          </section>

          <section className="ui-media-drawer__section">
            <h3>Metadata</h3>
            <div className="ui-media-drawer__fields">
              <Textarea
                label="Alt text"
                value={altDraft}
                onChange={(e) => onAltChange(e.target.value)}
                hint="Mô tả ảnh cho SEO / accessibility"
              />
              <Input
                label="Credit / nguồn"
                value={creditDraft}
                onChange={(e) => onCreditChange(e.target.value)}
              />
            </div>
          </section>
        </div>

        <div className="ui-media-drawer__toolbar">
          <div className="ui-media-drawer__tools">
            <MediaIconBtn tone="view" label="Full" onClick={onOpenFull}>
              <Maximize2 size={16} strokeWidth={2.15} />
            </MediaIconBtn>
            {src ? (
              <>
                <MediaIconBtn tone="copy" label="Copy" onClick={() => void copyText(src)}>
                  <Copy size={16} strokeWidth={2.15} />
                </MediaIconBtn>
                <MediaIconBtn tone="open" label="Mở" href={src}>
                  <ExternalLink size={16} strokeWidth={2.15} />
                </MediaIconBtn>
              </>
            ) : null}
            <MediaIconBtn
              tone="danger"
              label="Xóa"
              disabled={deleting}
              onClick={onDelete}
            >
              <Trash2 size={16} strokeWidth={2.15} />
            </MediaIconBtn>
          </div>
          <button
            type="button"
            className="ui-media-drawer__save"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="ui-spin" /> : <Check size={16} strokeWidth={2.3} />}
            Lưu
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function MediaLibraryPage() {
  const qc = useQueryClient();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(Math.max(DEFAULT_LIST_PER_PAGE, 48));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, pct: 0 });
  const [altDraft, setAltDraft] = useState('');
  const [creditDraft, setCreditDraft] = useState('');

  const queryKey = useMemo(
    () => ['media-library', { search, folder, kind, page, perPage }],
    [search, folder, kind, page, perPage],
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      mediaApi.library({
        search: search || undefined,
        folder: folder || undefined,
        kind: kind === 'all' ? undefined : kind,
        page,
        per_page: perPage,
      }),
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const folders = listQuery.data?.folders ?? [];

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setAltDraft('');
      setCreditDraft('');
      return;
    }
    setAltDraft(selected.alt || '');
    setCreditDraft(selected.credit || '');
  }, [selected?.id, selected?.alt, selected?.credit]);

  const remove = useMutation({
    mutationFn: (id: number) => mediaApi.removeLibrary(id),
    onSuccess: async (_, id) => {
      toast.success('Đã xóa media');
      if (selectedId === id) setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ['media-library'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMeta = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Chưa chọn media');
      return mediaApi.updateLibrary(selectedId, {
        alt: altDraft.trim() || null,
        credit: creditDraft.trim() || null,
      });
    },
    onSuccess: async () => {
      toast.success('Đã lưu thông tin media');
      await qc.invalidateQueries({ queryKey: ['media-library'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadFolder: MediaFolder =
    folder && isMediaFolder(folder) && folder !== 'video_files' ? folder : 'default';

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (!files.length) {
        toast.error('Chỉ hỗ trợ upload ảnh (JPG, PNG, WebP, GIF) tại thư viện này.');
        return;
      }

      setUploading(true);
      setUploadProgress({ done: 0, total: files.length, pct: 0 });
      let ok = 0;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        try {
          await mediaApi.upload(file, {
            folder: uploadFolder,
            variant: 'card',
            slug: file.name.replace(/\.[^.]+$/, ''),
            role: folder || 'library',
            onProgress: (pct) => {
              const overall = Math.round(((i + pct / 100) / files.length) * 100);
              setUploadProgress({ done: i, total: files.length, pct: overall });
            },
          });
          ok += 1;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Lỗi upload ${file.name}`);
        }
        setUploadProgress({
          done: i + 1,
          total: files.length,
          pct: Math.round(((i + 1) / files.length) * 100),
        });
      }

      setUploading(false);
      if (ok > 0) {
        toast.success(`Đã tải lên ${ok} ảnh`);
        setPage(1);
        await qc.invalidateQueries({ queryKey: ['media-library'] });
      }
    },
    [qc, uploadFolder],
  );

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  };

  const openLightboxFor = (item: MediaImage) => {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  return (
    <div className="ui-media-lib">
      <PageHeader
        eyebrow="Cài đặt"
        title="Thư viện Media"
        description="Quản lý ảnh đã upload — xem full, chỉnh alt, tải lên và xóa."
        actions={
          <HeadActions
            primary={
              <HeadCta
                icon={Upload}
                title="Tải ảnh lên"
                subtitle={
                  folder ? `Thư mục: ${mediaFolderLabel(folder)}` : 'Thư mục: Chung'
                }
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              />
            }
          />
        }
      />

      <input
        ref={fileRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="ui-media-lib__file-input"
        onChange={onPickFiles}
      />

      <div
        className={clsx('ui-media-lib__drop', dragOver && 'ui-media-lib__drop--active')}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
      >
        <ImagePlus size={18} />
        <div>
          <strong>Kéo thả ảnh vào đây</strong>
          <span>hoặc dùng nút Tải ảnh lên — JPG, PNG, WebP, GIF</span>
        </div>
      </div>

      {uploading ? (
        <div className="ui-media-lib__upload-bar" role="status">
          <Loader2 size={16} className="ui-spin" />
          <div className="ui-media-lib__upload-bar-track">
            <div style={{ width: `${uploadProgress.pct}%` }} />
          </div>
          <span>
            Đang tải {uploadProgress.done}/{uploadProgress.total} · {uploadProgress.pct}%
          </span>
        </div>
      ) : null}

      <div className="ui-media-lib__toolbar">
        <div className="ui-media-lib__search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Tìm tên file, alt, path…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="ui-media-lib__kind" role="tablist" aria-label="Loại media">
          {(
            [
              ['all', 'Tất cả'],
              ['image', 'Ảnh'],
              ['video', 'Video'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className={clsx(kind === value && 'is-active')}
              onClick={() => {
                setPage(1);
                setKind(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
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

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="file"
        loading={listQuery.isLoading}
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPage(1);
          setPerPage(n);
        }}
      />

      <div className="ui-media-lib__grid-wrap">
        {listQuery.isLoading ? (
          <div className="ui-media-lib__state">
            <Loader2 size={22} className="ui-spin" />
            Đang tải thư viện…
          </div>
        ) : items.length === 0 ? (
          <div className="ui-media-lib__state">
            <ImagePlus size={28} />
            <strong>Chưa có media</strong>
            <span>Tải ảnh lên hoặc chọn bộ lọc khác.</span>
          </div>
        ) : (
          <div className="ui-media-lib__grid">
            {items.map((item) => {
              const thumb = previewUrl(item);
              const active = item.id === selectedId;
              return (
                <article
                  key={item.id}
                  className={clsx('ui-media-card-tile', active && 'is-active')}
                >
                  <button
                    type="button"
                    className="ui-media-card-tile__hit"
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => openLightboxFor(item)}
                  >
                    <div className="ui-media-card-tile__frame">
                      {item.kind === 'video' ? (
                        <div className="ui-media-card-tile__video-fallback">
                          <Film size={22} />
                          <span>Video</span>
                        </div>
                      ) : thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={item.alt || item.filename || ''} loading="lazy" />
                      ) : (
                        <div className="ui-media-card-tile__video-fallback">
                          <ImagePlus size={22} />
                        </div>
                      )}
                      <div className="ui-media-card-tile__shade" />
                      <div className="ui-media-card-tile__badges">
                        {item.kind === 'video' ? <span>Video</span> : null}
                        {item.has_variants ? <span>Variants</span> : null}
                      </div>
                    </div>
                    <div className="ui-media-card-tile__caption">
                      <strong title={item.filename || undefined}>
                        {item.filename || `#${item.id}`}
                      </strong>
                      <small>
                        {item.width && item.height ? `${item.width}×${item.height}` : '—'}
                        {' · '}
                        {formatBytes(item.size_bytes)}
                      </small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="ui-media-card-tile__zoom"
                    title="Xem full"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightboxFor(item);
                    }}
                  >
                    <Maximize2 size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selected ? (
        <MediaDetailDrawer
          item={selected}
          altDraft={altDraft}
          creditDraft={creditDraft}
          onAltChange={setAltDraft}
          onCreditChange={setCreditDraft}
          onClose={() => setSelectedId(null)}
          onOpenFull={() => openLightboxFor(selected)}
          onSave={() => saveMeta.mutate()}
          saving={saveMeta.isPending}
          deleting={remove.isPending}
          onDelete={() => {
            if (confirm(`Xóa «${selected.filename || selected.id}»? Không hoàn tác được.`)) {
              remove.mutate(selected.id);
            }
          }}
        />
      ) : null}

      {lightboxIndex != null && items[lightboxIndex] ? (
        <MediaLightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}
