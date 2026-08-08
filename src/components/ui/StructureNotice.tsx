'use client';

import { AlertTriangle, Lock } from 'lucide-react';
import { useStructureLocked } from '@/hooks/useStructureLock';
import { useParentLocaleGate } from '@/hooks/useParentLocaleGate';

/** Banner khi đang sửa bản dịch — nhắc khóa trường cấu trúc + cảnh báo trang cha thiếu locale. */
export function StructureNotice() {
  const structureLocked = useStructureLocked();
  const parentGate = useParentLocaleGate();

  if (!parentGate.blocked && !structureLocked) return null;

  const localeLabel = (parentGate.locale || '').toUpperCase();
  const parentLabel = parentGate.parent?.label
    ? parentGate.parent.label.replace(/\s*—\s*\(chưa có bản dịch[^)]*\)\s*$/i, '').trim()
    : null;

  return (
    <div className="ui-form-notices">
      {parentGate.blocked ? (
        <div className="ui-parent-locale-notice" role="alert" aria-live="assertive">
          <div className="ui-parent-locale-notice__glow" aria-hidden />
          <div className="ui-parent-locale-notice__icon">
            <AlertTriangle size={20} strokeWidth={2.2} aria-hidden />
          </div>
          <div className="ui-parent-locale-notice__body">
            <p className="ui-parent-locale-notice__eyebrow">Không thể chỉnh bản dịch này</p>
            <h3 className="ui-parent-locale-notice__title">
              Trang cha chưa có ngôn ngữ {localeLabel}
            </h3>
            <p className="ui-parent-locale-notice__text">
              {parentLabel ? (
                <>
                  Trang cha đang chọn là <strong>{parentLabel}</strong> — chưa có bản dịch / URL
                  cho <strong>{localeLabel}</strong>.
                </>
              ) : (
                <>
                  Trang cha SEO chưa có bản dịch / URL cho ngôn ngữ <strong>{localeLabel}</strong>.
                </>
              )}{' '}
              Hãy mở trang cha, tạo bản dịch {localeLabel} và lưu xong — rồi quay lại trang này.
              Các nút <strong>Lưu</strong> và <strong>AI dịch</strong> bị khóa để tránh lỗi URL
              phân tầng.
            </p>
            <p className="ui-parent-locale-notice__hint">
              Tip: chuyển về ngôn ngữ mặc định ({(parentGate.defaultLocale || 'vi').toUpperCase()})
              nếu cần đổi trang cha, hoặc dịch đúng trang cha trước.
            </p>
          </div>
        </div>
      ) : null}

      {structureLocked && !parentGate.blocked ? (
        <div className="ui-structure-notice" role="status">
          <Lock size={15} aria-hidden />
          <p>
            Đang sửa <strong>bản dịch</strong> — chỉ chỉnh nội dung có thể dịch (tiêu đề, mô tả,
            slug SEO…). Trường cấu trúc / tính năng (trạng thái, switch, ảnh, trang cha, điểm đánh
            giá, số ngày/đêm, quan hệ…) bị khóa; chỉnh chúng ở ngôn ngữ mặc định.
          </p>
        </div>
      ) : null}

      {structureLocked && parentGate.blocked ? (
        <div className="ui-structure-notice ui-structure-notice--muted" role="status">
          <Lock size={15} aria-hidden />
          <p>
            Đồng thời đang ở tab bản dịch — sau khi trang cha sẵn sàng, bạn chỉ sửa nội dung có thể
            dịch; trường cấu trúc vẫn khóa ở ngôn ngữ mặc định.
          </p>
        </div>
      ) : null}
    </div>
  );
}
