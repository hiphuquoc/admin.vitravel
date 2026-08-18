'use client';

import { Textarea } from '@/components/ui/Field';
import { ArticleContentEditor } from '@/components/editor/ArticleContentEditor';

/** Label/hint chuẩn — cùng chỗ trên public listing (H1 + khối dưới lưới). */
export const LISTING_CHROME_COPY = {
  subtitleLabel: 'Mô tả ngắn',
  subtitleHint: 'Hiện dưới tiêu đề (H1) trang listing.',
  seoBodyLabel: 'Đoạn SEO cuối listing',
  seoBodyHint: 'HTML dưới lưới sản phẩm. Để trống thì không hiển thị.',
} as const;

type Props = {
  subtitle: string;
  seoBody: string;
  onSubtitleChange: (value: string) => void;
  onSeoBodyChange: (value: string) => void;
  subtitleName: string;
  seoBodyName: string;
  /** Tăng sau AI apply để TipTap nạp HTML mới. */
  editorEpoch?: number;
};

export function ListingChromeCopyFields({
  subtitle,
  seoBody,
  onSubtitleChange,
  onSeoBodyChange,
  subtitleName,
  seoBodyName,
  editorEpoch = 0,
}: Props) {
  return (
    <>
      <Textarea
        label={LISTING_CHROME_COPY.subtitleLabel}
        hint={LISTING_CHROME_COPY.subtitleHint}
        name={subtitleName}
        value={subtitle}
        onChange={(e) => onSubtitleChange(e.target.value)}
        rows={3}
      />
      <ArticleContentEditor
        key={`${seoBodyName}-${editorEpoch}`}
        label={LISTING_CHROME_COPY.seoBodyLabel}
        hint={LISTING_CHROME_COPY.seoBodyHint}
        format="html"
        compact
        aiFieldKey={seoBodyName}
        value={seoBody}
        onChange={onSeoBodyChange}
      />
    </>
  );
}
