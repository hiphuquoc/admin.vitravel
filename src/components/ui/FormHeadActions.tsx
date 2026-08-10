'use client';

import { ArrowLeft } from 'lucide-react';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { ViewPublicButton } from '@/components/ui/ViewPublicButton';

/**
 * Header actions chuẩn cho form chỉnh sửa — dùng chung mọi trang.
 * [Xem trang?] + Quay lại; khi không có Xem trang thì back nằm 1 hàng gọn (không chèn hàng).
 */
export function FormHeadActions({
  backHref,
  backSubtitle = 'Về danh sách',
  viewHref,
  className,
}: {
  backHref: string;
  backSubtitle?: string;
  viewHref?: string | null;
  className?: string;
}) {
  return (
    <HeadActions
      className={className}
      primary={viewHref ? <ViewPublicButton href={viewHref} /> : undefined}
      secondary={
        <HeadSecondary
          href={backHref}
          icon={ArrowLeft}
          title="Quay lại"
          subtitle={backSubtitle}
        />
      }
    />
  );
}
