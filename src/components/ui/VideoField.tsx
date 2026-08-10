'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Film, Loader2, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { mediaApi } from '@/lib/services';
import type { MediaImage } from '@/lib/types';
import { useStructureLocked } from '@/hooks/useStructureLock';
import { useReportMediaUpload } from '@/hooks/useMediaUploadBusy';

export type VideoFieldState = {
  media: MediaImage | null;
  remove: boolean;
};

type VideoFieldProps = {
  label?: string;
  ariaLabel?: string;
  value: VideoFieldState;
  onChange: (next: VideoFieldState) => void;
  className?: string;
  hint?: string;
  disabled?: boolean;
  structure?: boolean;
};

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function VideoField({
  label,
  ariaLabel,
  value,
  onChange,
  className,
  hint,
  disabled,
  structure = true,
}: VideoFieldProps) {
  const a11y = ariaLabel || label || 'Video';
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const locked = useStructureLocked();
  const isDisabled = !!disabled || (structure && locked);
  useReportMediaUpload(uploading);

  const metaQuery = useQuery({
    queryKey: ['media-video-meta'],
    queryFn: () => mediaApi.videoMeta(),
    staleTime: 60_000,
  });

  const maxKb = metaQuery.data?.max_upload_kb ?? 1048576;
  const displayUrl =
    localPreview || (!value.remove ? value.media?.url || value.media?.url_lg || null : null);
  const hasVideo = !!displayUrl;
  const fileMeta = !value.remove ? value.media : null;

  // Chỉ abort/revoke khi unmount — tránh huỷ XHR khi set preview blob.
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
    const okType =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!okType) {
      toast.error('Vui lòng chọn file video (MP4, WebM, MOV).');
      return;
    }
    if (file.size > maxKb * 1024) {
      toast.error(`Video vượt quá ${Math.round(maxKb / 1024)}MB. Chọn file nhỏ hơn.`);
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
      .uploadVideo(file, {
        folder: 'video_files',
        signal: ctrl.signal,
        onProgress: setProgress,
      })
      .then((media) => {
        if (abortRef.current !== ctrl) return;
        clearLocal();
        setUploading(false);
        setProgress(100);
        onChange({ media, remove: false });
        toast.success('Video đã sẵn sàng — nhấn Lưu để gắn vào nội dung');
      })
      .catch((err: Error) => {
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

  return (
    <div className={clsx('ui-video-field', isDisabled && 'ui-video-field--disabled', className)}>
      {label ? <div className="ui-video-field__label">{label}</div> : null}
      <div
        className={clsx(
          'ui-video-field__area',
          hasVideo && 'ui-video-field__area--has',
          dragOver && 'ui-video-field__area--drag',
          uploading && 'ui-video-field__area--busy',
          isDisabled && 'ui-video-field__area--disabled',
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
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          className="ui-video-field__input"
          aria-label={a11y}
          disabled={isDisabled}
          onChange={onInputChange}
        />

        {hasVideo ? (
          <div className="ui-video-field__preview">
            <video src={displayUrl!} controls playsInline preload="metadata" />
            {uploading ? (
              <div className="ui-video-field__progress">
                <div className="ui-video-field__progress-bar" style={{ width: `${progress}%` }} />
                <span>
                  <Loader2 size={14} className="ui-spin" /> Đang tải… {progress}%
                </span>
              </div>
            ) : isDisabled ? null : (
              <div className="ui-video-field__overlay">
                <button type="button" className="ui-video-field__action" onClick={openPicker}>
                  <Pencil size={15} />
                  Thay đổi
                </button>
                <button
                  type="button"
                  className="ui-video-field__action ui-video-field__action--danger"
                  onClick={remove}
                >
                  <Trash2 size={15} />
                  Xóa
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="ui-video-field__dropzone"
            onClick={openPicker}
            disabled={uploading || isDisabled}
            aria-label={a11y}
          >
            <span className="ui-video-field__drop-icon" aria-hidden>
              {uploading ? <Loader2 size={18} className="ui-spin" /> : <Film size={18} />}
            </span>
            <span className="ui-video-field__drop-title">
              {uploading
                ? `Đang tải… ${progress}%`
                : isDisabled
                  ? 'Video khóa (bản dịch)'
                  : 'Kéo thả hoặc chọn video'}
            </span>
            <span className="ui-video-field__drop-sub">
              {uploading
                ? 'Vui lòng giữ tab mở đến khi xong…'
                : isDisabled
                  ? 'Chỉnh ở ngôn ngữ mặc định'
                  : metaQuery.data?.hint || 'MP4, WebM, MOV'}
            </span>
          </button>
        )}
      </div>
      {fileMeta?.filename || hint ? (
        <p className="ui-video-field__meta">
          {fileMeta?.filename
            ? `${fileMeta.filename}${formatBytes(fileMeta.size_bytes) ? ` · ${formatBytes(fileMeta.size_bytes)}` : ''}`
            : hint}
        </p>
      ) : null}
    </div>
  );
}

export function emptyVideoField(media: MediaImage | null = null): VideoFieldState {
  return { media, remove: false };
}
