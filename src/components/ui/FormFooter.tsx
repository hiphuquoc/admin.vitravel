'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AiTranslatePageButton } from '@/components/ui/AiTranslatePageButton';
import { useFormActionsLocked } from '@/hooks/useStructureLock';
import { useMediaUploadBusy } from '@/hooks/useMediaUploadBusy';
import toast from '@/lib/toast';

type FormFooterProps = {
  /** Href nút Hủy — bỏ qua nếu không cần. */
  cancelHref?: string;
  cancelLabel?: string;
  /** Mặc định «Lưu» — đồng bộ mọi form. */
  submitLabel?: string;
  loading?: boolean;
  /** URL trang public — nút mắt cạnh Lưu (tab mới). */
  viewHref?: string | null;
  viewLabel?: string;
  /** Nút / nội dung phụ bên trái (trước Hủy). */
  leading?: ReactNode;
  /** Hiện nút AI dịch (mặc định bật — tự ẩn nếu không phải bản dịch / chưa đăng ký). */
  showAiTranslate?: boolean;
  submitDisabled?: boolean;
  className?: string;
};

/** Thanh sticky đáy form — AI dịch (trái) + Hủy + Xem + Lưu. */
export function FormFooter({
  cancelHref,
  cancelLabel = 'Hủy',
  submitLabel = 'Lưu',
  loading = false,
  viewHref,
  viewLabel = 'Xem',
  leading,
  showAiTranslate = true,
  submitDisabled = false,
  className = 'ui-form-footer',
}: FormFooterProps) {
  const actionsLocked = useFormActionsLocked();
  const mediaBusy = useMediaUploadBusy();
  const rootRef = useRef<HTMLDivElement>(null);
  const blocked = actionsLocked || mediaBusy || submitDisabled;

  // Khóa submit + class veil trên <form> cha khi trang cha thiếu locale / đang upload media.
  useEffect(() => {
    const host = rootRef.current;
    const form = host?.closest('form');
    if (!form) return;

    form.classList.toggle('ui-form--parent-locale-blocked', actionsLocked);
    form.classList.toggle('ui-form--media-upload-busy', mediaBusy);

    if (!actionsLocked && !mediaBusy) return;

    const onSubmit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (mediaBusy) {
        toast.error('Đang tải ảnh/video — chờ xong rồi nhấn Lưu.');
        return;
      }
      toast.error(
        'Trang cha chưa có bản dịch cho ngôn ngữ này. Hãy dịch trang cha trước khi lưu.',
      );
    };

    form.addEventListener('submit', onSubmit, true);
    return () => {
      form.classList.remove('ui-form--parent-locale-blocked');
      form.classList.remove('ui-form--media-upload-busy');
      form.removeEventListener('submit', onSubmit, true);
    };
  }, [actionsLocked, mediaBusy]);

  return (
    <div ref={rootRef} className={className}>
      <div className="ui-form-footer__start">
        {showAiTranslate ? <AiTranslatePageButton /> : null}
        {leading}
      </div>
      <div className="ui-form-footer__end">
        {cancelHref ? (
          <Link href={cancelHref}>
            <Button type="button" variant="secondary" disabled={loading || mediaBusy}>
              {cancelLabel}
            </Button>
          </Link>
        ) : null}
        {viewHref && !actionsLocked ? (
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn ui-btn--secondary ui-form-footer__view"
            title="Mở trang public trên website"
            aria-disabled={mediaBusy || loading ? true : undefined}
            onClick={(e) => {
              if (mediaBusy || loading) {
                e.preventDefault();
                toast.error('Đang tải ảnh/video — chờ xong rồi mở trang.');
              }
            }}
          >
            <Eye size={17} strokeWidth={2.15} aria-hidden />
            <span>{viewLabel}</span>
          </a>
        ) : null}
        <Button
          type="submit"
          loading={loading}
          disabled={blocked}
          title={
            mediaBusy
              ? 'Đang tải ảnh/video — chờ xong rồi lưu'
              : submitDisabled
                ? 'Không có quyền lưu'
                : actionsLocked
                  ? 'Trang cha chưa có bản dịch cho ngôn ngữ này — không thể lưu'
                  : undefined
          }
        >
          <Save size={17} />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
