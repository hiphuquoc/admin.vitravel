'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, Images, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { mediaApi } from '@/lib/services';
import type { MediaFolder, MediaImage } from '@/lib/types';
import { useStructureLocked } from '@/hooks/useStructureLock';
import { useReportMediaUpload } from '@/hooks/useMediaUploadBusy';
import { emptyImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { MediaLibraryPicker } from '@/components/ui/MediaLibraryPicker';

export type GalleryFieldRow = {
  key: string;
  image: ImageFieldState;
};

type PendingUpload = {
  key: string;
  preview: string;
  progress: number;
  name: string;
};

type GalleryFieldProps = {
  folder: MediaFolder;
  slug?: string | null;
  role?: string | null;
  value: GalleryFieldRow[];
  onChange: (next: GalleryFieldRow[]) => void;
  className?: string;
  disabled?: boolean;
  structure?: boolean;
  /** Giới hạn số ảnh (mặc định 40). */
  maxItems?: number;
  ariaLabel?: string;
};

function newKey(prefix = 'gal') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

/**
 * Gallery multi-upload — một khung click/kéo thả chọn nhiều ảnh,
 * upload tuần tự, lưới preview với thay / xóa từng ô.
 */
export function GalleryField({
  folder,
  slug,
  role = 'gallery',
  value,
  onChange,
  className,
  disabled,
  structure = true,
  maxItems = 40,
  ariaLabel = 'Gallery ảnh',
}: GalleryFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryReplaceIndex, setLibraryReplaceIndex] = useState<number | null>(null);
  const locked = useStructureLocked();
  const isDisabled = !!disabled || (structure && locked);
  const uploading = pending.length > 0 || batchProgress !== null;
  useReportMediaUpload(uploading);

  const metaQuery = useQuery({
    queryKey: ['media-meta'],
    queryFn: () => mediaApi.meta(),
    staleTime: 60_000,
  });
  const maxKb = metaQuery.data?.max_upload_kb ?? 5120;

  const items = value.filter((row) => !!row.image.media && !row.image.remove);
  const hasItems = items.length > 0 || pending.length > 0;
  const slotsLeft = Math.max(0, maxItems - items.length);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      pending.forEach((p) => {
        if (p.preview.startsWith('blob:')) URL.revokeObjectURL(p.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLibraryAdd = () => {
    if (isDisabled || uploading) return;
    if (slotsLeft <= 0) {
      toast.error(`Tối đa ${maxItems} ảnh gallery.`);
      return;
    }
    setLibraryReplaceIndex(null);
    setLibraryOpen(true);
  };

  const openLibraryReplace = (index: number) => {
    if (isDisabled || uploading) return;
    setLibraryReplaceIndex(index);
    setLibraryOpen(true);
  };

  const applyLibraryPicks = (picked: MediaImage[]) => {
    const existingIds = new Set(
      items.map((row) => row.image.media?.id).filter((id): id is number => typeof id === 'number'),
    );

    if (libraryReplaceIndex != null && libraryReplaceIndex >= 0) {
      const media = picked[0];
      if (!media) return;
      const next = [...items];
      if (libraryReplaceIndex < next.length) {
        next[libraryReplaceIndex] = { key: newKey('gal'), image: emptyImageField(media) };
        onChange(next);
        toast.success('Đã chọn ảnh từ thư viện — nhấn Lưu để cập nhật');
      }
      setLibraryReplaceIndex(null);
      return;
    }

    const fresh = picked.filter((m) => !existingIds.has(m.id)).slice(0, slotsLeft);
    if (fresh.length === 0) {
      toast.error('Ảnh đã có trong gallery hoặc không còn chỗ.');
      return;
    }
    onChange([
      ...value.filter((r) => !!r.image.media && !r.image.remove),
      ...fresh.map((media) => ({ key: newKey('gal'), image: emptyImageField(media) })),
    ]);
    toast.success(
      fresh.length === 1
        ? 'Đã chọn 1 ảnh từ thư viện — nhấn Lưu để gắn vào nội dung'
        : `Đã chọn ${fresh.length} ảnh từ thư viện — nhấn Lưu để gắn vào nội dung`,
    );
  };

  const openMultiPicker = () => {
    if (isDisabled || uploading) return;
    if (slotsLeft <= 0) {
      toast.error(`Tối đa ${maxItems} ảnh gallery.`);
      return;
    }
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const openReplacePicker = (index: number) => {
    if (isDisabled || uploading) return;
    replaceIndexRef.current = index;
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const uploadOne = async (
    file: File,
    ctrl: AbortController,
    onProgress: (pct: number) => void,
  ): Promise<MediaImage> => {
    return mediaApi.upload(file, {
      folder,
      variant: 'card',
      slug,
      role,
      signal: ctrl.signal,
      onProgress,
    });
  };

  const ingestFiles = async (fileList: FileList | File[] | null | undefined) => {
    if (isDisabled || uploading || !fileList) return;

    const raw = Array.from(fileList);
    if (raw.length === 0) return;

    const images = raw.filter(isImageFile);
    if (images.length === 0) {
      toast.error('Vui lòng chọn file ảnh (JPG, PNG, WebP, GIF).');
      return;
    }
    if (images.length < raw.length) {
      toast.error('Đã bỏ qua file không phải ảnh.');
    }

    const oversized = images.filter((f) => f.size > maxKb * 1024);
    const okFiles = images.filter((f) => f.size <= maxKb * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} ảnh vượt quá ${maxKb}KB — đã bỏ qua.`);
    }
    if (okFiles.length === 0) return;

    const take = okFiles.slice(0, slotsLeft);
    if (take.length < okFiles.length) {
      toast.error(`Chỉ còn ${slotsLeft} chỗ — đã lấy ${take.length} ảnh đầu.`);
    }
    if (take.length === 0) {
      toast.error(`Tối đa ${maxItems} ảnh gallery.`);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const localPending: PendingUpload[] = take.map((file) => ({
      key: newKey('up'),
      preview: URL.createObjectURL(file),
      progress: 0,
      name: file.name,
    }));
    setPending(localPending);
    setBatchProgress({ done: 0, total: take.length });

    const uploaded: GalleryFieldRow[] = [];
    let failed = 0;

    for (let i = 0; i < take.length; i++) {
      if (ctrl.signal.aborted) break;
      const file = take[i];
      const pendingKey = localPending[i].key;
      try {
        const media = await uploadOne(file, ctrl, (pct) => {
          setPending((prev) =>
            prev.map((p) => (p.key === pendingKey ? { ...p, progress: pct } : p)),
          );
        });
        uploaded.push({
          key: newKey('gal'),
          image: emptyImageField(media),
        });
        setPending((prev) => {
          const hit = prev.find((p) => p.key === pendingKey);
          if (hit?.preview.startsWith('blob:')) URL.revokeObjectURL(hit.preview);
          return prev.filter((p) => p.key !== pendingKey);
        });
        setBatchProgress({ done: i + 1, total: take.length });
      } catch (err) {
        failed += 1;
        setPending((prev) => {
          const hit = prev.find((p) => p.key === pendingKey);
          if (hit?.preview.startsWith('blob:')) URL.revokeObjectURL(hit.preview);
          return prev.filter((p) => p.key !== pendingKey);
        });
        if (err instanceof Error && err.message === 'Đã huỷ upload.') break;
        // continue remaining
      }
    }

    if (abortRef.current === ctrl) {
      abortRef.current = null;
    }
    setPending([]);
    setBatchProgress(null);

    if (uploaded.length > 0) {
      onChange([...value.filter((r) => !!r.image.media && !r.image.remove), ...uploaded]);
      toast.success(
        uploaded.length === 1
          ? 'Đã tải 1 ảnh — nhấn Lưu để gắn vào nội dung'
          : `Đã tải ${uploaded.length} ảnh — nhấn Lưu để gắn vào nội dung`,
      );
    }
    if (failed > 0 && uploaded.length === 0) {
      toast.error('Upload gallery thất bại.');
    } else if (failed > 0) {
      toast.error(`${failed} ảnh upload lỗi — các ảnh còn lại đã thêm.`);
    }
  };

  const replaceAt = async (index: number, file: File | undefined | null) => {
    if (isDisabled || uploading || !file) return;
    if (!isImageFile(file)) {
      toast.error('Vui lòng chọn file ảnh (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > maxKb * 1024) {
      toast.error(`Ảnh vượt quá ${maxKb}KB. Chọn ảnh nhỏ hơn.`);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const preview = URL.createObjectURL(file);
    const pendingKey = newKey('rep');
    setPending([{ key: pendingKey, preview, progress: 0, name: file.name }]);
    setBatchProgress({ done: 0, total: 1 });

    try {
      const media = await uploadOne(file, ctrl, (pct) => {
        setPending((prev) =>
          prev.map((p) => (p.key === pendingKey ? { ...p, progress: pct } : p)),
        );
      });
      const next = [...items];
      if (index >= 0 && index < next.length) {
        next[index] = { key: newKey('gal'), image: emptyImageField(media) };
        onChange(next);
        toast.success('Đã thay ảnh — nhấn Lưu để cập nhật');
      }
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Đã huỷ upload.')) {
        toast.error(err instanceof Error ? err.message : 'Thay ảnh thất bại');
      }
    } finally {
      URL.revokeObjectURL(preview);
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending([]);
      setBatchProgress(null);
    }
  };

  const removeAt = (index: number) => {
    if (isDisabled || uploading) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    if (isDisabled || uploading) return;
    onChange([]);
  };

  const onMultiChange = (e: ChangeEvent<HTMLInputElement>) => {
    void ingestFiles(e.target.files);
    e.target.value = '';
  };

  const onReplaceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const idx = replaceIndexRef.current;
    replaceIndexRef.current = null;
    void replaceAt(idx ?? -1, e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void ingestFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={clsx(
        'ui-gallery-field',
        isDisabled && 'ui-gallery-field--disabled',
        uploading && 'ui-gallery-field--busy',
        className,
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="ui-gallery-field__input"
        aria-label={ariaLabel}
        disabled={isDisabled}
        onChange={onMultiChange}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="ui-gallery-field__input"
        aria-label="Thay ảnh gallery"
        disabled={isDisabled}
        onChange={onReplaceChange}
      />

      {!hasItems ? (
        <div className="ui-gallery-field__empty">
          <button
            type="button"
            className={clsx(
              'ui-gallery-field__dropzone',
              dragOver && 'is-drag',
              uploading && 'is-busy',
            )}
            onClick={openMultiPicker}
            disabled={uploading || isDisabled}
            onDragEnter={(e) => {
              if (isDisabled) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              if (isDisabled) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDrop}
            aria-label={ariaLabel}
          >
            <span className="ui-gallery-field__drop-icon" aria-hidden>
              {uploading ? <Loader2 size={18} className="ui-spin" /> : <ImagePlus size={18} />}
            </span>
            <span className="ui-gallery-field__drop-title">
              {isDisabled
                ? 'Gallery khóa (bản dịch)'
                : uploading
                  ? `Đang tải… ${batchProgress?.done ?? 0}/${batchProgress?.total ?? 0}`
                  : 'Tải ảnh mới'}
            </span>
            <span className="ui-gallery-field__drop-sub">
              {isDisabled ? 'Chỉnh ở ngôn ngữ mặc định' : 'JPG · PNG · WebP · kéo thả'}
            </span>
          </button>
          {!isDisabled && !uploading ? (
            <button type="button" className="ui-gallery-field__library-cta" onClick={openLibraryAdd}>
              <Images size={14} />
              Chọn từ thư viện
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={clsx('ui-gallery-field__panel', dragOver && 'is-drag')}
          onDragEnter={(e) => {
            if (isDisabled) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            if (isDisabled) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
        >
          <div className="ui-gallery-field__toolbar">
            <span className="ui-gallery-field__count">
              {items.length} ảnh
              {batchProgress ? ` · đang tải ${batchProgress.done}/${batchProgress.total}` : ''}
            </span>
            {!isDisabled && !uploading ? (
              <div className="ui-gallery-field__toolbar-actions">
                <button type="button" className="ui-gallery-field__link" onClick={openMultiPicker}>
                  <Plus size={14} /> Tải mới
                </button>
                <button type="button" className="ui-gallery-field__link" onClick={openLibraryAdd}>
                  <Images size={14} /> Thư viện
                </button>
                {items.length > 0 ? (
                  <button type="button" className="ui-gallery-field__link is-danger" onClick={clearAll}>
                    <Trash2 size={14} /> Xóa hết
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="ui-gallery-field__grid">
            {items.map((row, index) => {
              const url =
                row.image.media?.url_thumb ||
                row.image.media?.url ||
                row.image.media?.url_lg ||
                null;
              return (
                <div key={row.key} className="ui-gallery-field__tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url ? <img src={url} alt={row.image.media?.alt || `Gallery ${index + 1}`} /> : null}
                  {!isDisabled && !uploading ? (
                    <div className="ui-gallery-field__tile-actions">
                      <button
                        type="button"
                        title="Thay bằng file mới"
                        aria-label="Thay bằng file mới"
                        onClick={() => openReplacePicker(index)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Chọn từ thư viện"
                        aria-label="Chọn từ thư viện"
                        onClick={() => openLibraryReplace(index)}
                      >
                        <Images size={14} />
                      </button>
                      <button
                        type="button"
                        title="Xóa"
                        aria-label="Xóa"
                        className="is-danger"
                        onClick={() => removeAt(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {pending.map((p) => (
              <div key={p.key} className="ui-gallery-field__tile is-pending">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={p.name} />
                <div className="ui-gallery-field__tile-progress">
                  <div className="ui-gallery-field__tile-bar" style={{ width: `${p.progress}%` }} />
                  <span>
                    <Loader2 size={12} className="ui-spin" /> {p.progress}%
                  </span>
                </div>
              </div>
            ))}

            {!isDisabled && !uploading && slotsLeft > 0 ? (
              <>
                <button
                  type="button"
                  className="ui-gallery-field__add-tile"
                  onClick={openMultiPicker}
                  aria-label="Tải ảnh gallery mới"
                >
                  <Plus size={18} />
                  <span>Tải mới</span>
                </button>
                <button
                  type="button"
                  className="ui-gallery-field__add-tile"
                  onClick={openLibraryAdd}
                  aria-label="Chọn ảnh từ thư viện"
                >
                  <Images size={18} />
                  <span>Thư viện</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => {
          setLibraryOpen(false);
          setLibraryReplaceIndex(null);
        }}
        onSelect={applyLibraryPicks}
        multiple={libraryReplaceIndex == null}
        maxSelect={libraryReplaceIndex == null ? slotsLeft : 1}
        excludeIds={
          libraryReplaceIndex == null
            ? items
                .map((row) => row.image.media?.id)
                .filter((id): id is number => typeof id === 'number')
            : items
                .filter((_, i) => i !== libraryReplaceIndex)
                .map((row) => row.image.media?.id)
                .filter((id): id is number => typeof id === 'number')
        }
        defaultFolder={folder}
        title={libraryReplaceIndex == null ? 'Chọn ảnh gallery' : 'Thay ảnh từ thư viện'}
      />
    </div>
  );
}

export function emptyGalleryRow(media: MediaImage | null = null): GalleryFieldRow {
  return {
    key: newKey('gal'),
    image: emptyImageField(media),
  };
}
