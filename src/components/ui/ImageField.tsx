'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Images, Loader2, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { mediaApi } from '@/lib/services';
import type { MediaFolder, MediaImage } from '@/lib/types';
import { useStructureLocked } from '@/hooks/useStructureLock';
import { useReportMediaUpload } from '@/hooks/useMediaUploadBusy';
import { MediaLibraryPicker } from '@/components/ui/MediaLibraryPicker';

export type ImageFieldState = {
  media: MediaImage | null;
  remove: boolean;
};

type ImageFieldProps = {
  /** Label hiển thị trên dropzone (khi nhiều ảnh trong cùng card). */
  label?: string;
  /** a11y name for the control */
  ariaLabel?: string;
  folder: MediaFolder;
  /** SEO slug trang/entity — tạo URL thân thiện (vd. tour-phu-quoc-cover.webp). */
  slug?: string | null;
  /** Vai trò file: cover | banner | avatar | gallery | … */
  role?: string | null;
  aspectRatio?: string;
  variant?: 'thumb' | 'card' | 'lg' | 'full';
  value: ImageFieldState;
  onChange: (next: ImageFieldState) => void;
  className?: string;
  disabled?: boolean;
  /** Mặc định true — ảnh là tài nguyên dùng chung, khóa khi sửa bản dịch. */
  structure?: boolean;
};

export function ImageField({
  label,
  ariaLabel,
  folder,
  slug,
  role,
  aspectRatio = '3 / 2',
  variant = 'card',
  value,
  onChange,
  className,
  disabled,
  structure = true,
}: ImageFieldProps) {
  const a11y = ariaLabel || label || 'Ảnh';
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const locked = useStructureLocked();
  const isDisabled = !!disabled || (structure && locked);
  useReportMediaUpload(uploading);

  const metaQuery = useQuery({
    queryKey: ['media-meta'],
    queryFn: () => mediaApi.meta(),
    staleTime: 60_000,
  });

  const maxKb = metaQuery.data?.max_upload_kb ?? 5120;
  const displayUrl =
    localPreview ||
    (!value.remove
      ? value.media?.url_lg || value.media?.url || value.media?.url_thumb || null
      : null);
  const hasImage = !!displayUrl;

  // Chỉ huỷ XHR / revoke blob khi unmount — không phụ thuộc localPreview
  // (đổi preview trước đây abort nhầm upload vừa bắt đầu → kẹt "Đang tối ưu 0%").
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const clearLocal = () => {
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    setLocalPreview(null);
  };

  const pickFile = (file: File | undefined | null) => {
    if (isDisabled || uploading) return;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
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

    clearLocal();
    const blobUrl = URL.createObjectURL(file);
    previewUrlRef.current = blobUrl;
    setLocalPreview(blobUrl);
    setUploading(true);
    setProgress(0);

    mediaApi
      .upload(file, {
        folder,
        variant,
        slug,
        role,
        signal: ctrl.signal,
        onProgress: setProgress,
      })
      .then((media) => {
        if (abortRef.current !== ctrl) return;
        clearLocal();
        setUploading(false);
        setProgress(100);
        onChange({ media, remove: false });
        toast.success('Ảnh đã sẵn sàng — nhấn Lưu để gắn vào nội dung');
      })
      .catch((err: Error) => {
        // Upload cũ bị thay bằng lần chọn mới — bỏ qua.
        if (abortRef.current !== ctrl) return;
        clearLocal();
        setUploading(false);
        setProgress(0);
        if (err.message === 'Đã huỷ upload.') return;
        toast.error(err.message || 'Upload thất bại');
      });
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const remove = () => {
    if (isDisabled) return;
    abortRef.current?.abort();
    abortRef.current = null;
    clearLocal();
    setUploading(false);
    setProgress(0);
    onChange({ media: null, remove: true });
  };

  const openPicker = () => {
    if (isDisabled || uploading) return;
    inputRef.current?.click();
  };

  const openLibrary = () => {
    if (isDisabled || uploading) return;
    setLibraryOpen(true);
  };

  const applyLibraryPick = (picked: MediaImage[]) => {
    const media = picked[0];
    if (!media) return;
    abortRef.current?.abort();
    abortRef.current = null;
    clearLocal();
    setUploading(false);
    setProgress(0);
    onChange({ media, remove: false });
    toast.success('Đã chọn ảnh từ thư viện — nhấn Lưu để gắn vào nội dung');
  };

  return (
    <div className={clsx('ui-image-field', isDisabled && 'ui-image-field--disabled', className)}>
      {label ? <div className="ui-image-field__label">{label}</div> : null}
      <div
        className={clsx(
          'ui-image-field__area',
          hasImage && 'ui-image-field__area--has',
          dragOver && 'ui-image-field__area--drag',
          uploading && 'ui-image-field__area--busy',
          isDisabled && 'ui-image-field__area--disabled',
        )}
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
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="ui-image-field__input"
          aria-label={a11y}
          disabled={isDisabled}
          onChange={onInputChange}
        />

        {hasImage ? (
          <div className="ui-image-field__preview" style={{ aspectRatio }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl!} alt={value.media?.alt || a11y} referrerPolicy="no-referrer" />
            {uploading ? (
              <div className="ui-image-field__progress">
                <div className="ui-image-field__progress-bar" style={{ width: `${progress}%` }} />
                <span>
                  <Loader2 size={14} className="ui-spin" /> Đang tải ảnh… {progress}%
                </span>
              </div>
            ) : isDisabled ? null : (
              <div className="ui-image-field__overlay">
                <button type="button" className="ui-image-field__action" onClick={openPicker}>
                  <Pencil size={15} />
                  Tải mới
                </button>
                <button type="button" className="ui-image-field__action" onClick={openLibrary}>
                  <Images size={15} />
                  Thư viện
                </button>
                <button
                  type="button"
                  className="ui-image-field__action ui-image-field__action--danger"
                  onClick={remove}
                >
                  <Trash2 size={15} />
                  Xóa
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="ui-image-field__empty" style={{ aspectRatio }}>
            <button
              type="button"
              className="ui-image-field__dropzone"
              onClick={openPicker}
              disabled={uploading || isDisabled}
              aria-label={a11y}
            >
              <span className="ui-image-field__drop-icon" aria-hidden>
                {uploading ? <Loader2 size={18} className="ui-spin" /> : <ImagePlus size={18} />}
              </span>
              <span className="ui-image-field__drop-title">
                {uploading
                  ? `Đang tải… ${progress}%`
                  : isDisabled
                    ? 'Ảnh khóa (bản dịch)'
                    : 'Tải ảnh mới'}
              </span>
              <span className="ui-image-field__drop-sub">
                {uploading
                  ? 'Chưa gắn vào nội dung — chờ xong rồi nhấn Lưu'
                  : isDisabled
                    ? 'Chỉnh ở ngôn ngữ mặc định'
                    : 'JPG, PNG, WebP · kéo thả'}
              </span>
            </button>
            {!isDisabled && !uploading ? (
              <button type="button" className="ui-image-field__library-cta" onClick={openLibrary}>
                <Images size={14} />
                Chọn từ thư viện
              </button>
            ) : null}
          </div>
        )}
      </div>
      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={applyLibraryPick}
        multiple={false}
        maxSelect={1}
        excludeIds={value.media?.id ? [value.media.id] : []}
        defaultFolder={folder}
        title="Chọn ảnh từ thư viện"
      />
    </div>
  );
}

export function emptyImageField(media: MediaImage | null = null): ImageFieldState {
  return { media, remove: false };
}
