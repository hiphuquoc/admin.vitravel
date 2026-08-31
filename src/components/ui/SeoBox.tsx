'use client';

import clsx from 'clsx';
import { Search } from 'lucide-react';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { publicPageUrl } from '@/lib/publicUrl';
import { useStructureLocked } from '@/hooks/useStructureLock';

export type SeoParentOption = {
  id: number;
  label: string;
  slug_full?: string | null;
  reference_id?: number | null;
  /** True nếu trang cha đã có bản dịch đúng locale meta đang hỏi. */
  has_locale?: boolean;
};

export type SeoBoxValue = {
  seo_title: string;
  seo_slug: string;
  seo_description: string;
  seo_parent_id?: string;
  rating_aggregate_star?: string;
  rating_aggregate_count?: string;
};

type Props = {
  value: SeoBoxValue;
  onChange: (key: keyof SeoBoxValue, value: string) => void;
  parents?: SeoParentOption[];
  /** Hiện chọn trang cha (mặc định bật). */
  showParent?: boolean;
  /** Schema rating — mặc định bật (chuẩn tour / du thuyền / dịch vụ). */
  showRating?: boolean;
  slugRequired?: boolean;
  slugHint?: string;
  description?: string;
  locale?: string;
  defaultLocale?: string;
};

function normalizeParentSlug(parentSlugFull?: string | null): string {
  const raw = (parentSlugFull || '').trim().replace(/\/+$/, '');
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function buildSlugFullPreview(slug: string, parentSlugFull?: string | null): string {
  const segment = slug.trim().replace(/^\/+/, '');
  if (!segment) return normalizeParentSlug(parentSlugFull) === '/' ? '—' : normalizeParentSlug(parentSlugFull);
  const prefix = normalizeParentSlug(parentSlugFull);
  if (prefix === '/') return `/${segment}`;
  return `${prefix}/${segment}`;
}

function UrlParentPrefix({
  parentSlugFull,
  fullPreview,
  publicHref,
}: {
  parentSlugFull?: string | null;
  fullPreview: string;
  publicHref: string | null;
}) {
  const parentPath = normalizeParentSlug(parentSlugFull);
  const empty = !parentSlugFull?.trim();
  const className = clsx(
    'ui-field__url-prefix',
    publicHref && 'ui-field__url-prefix--link',
    empty && 'ui-field__url-prefix--empty',
  );
  const title = publicHref
    ? `Mở trang public: ${fullPreview}`
    : empty
      ? 'Chưa chọn trang cha — URL gốc'
      : `Tiền tố URL cha: ${parentPath}`;

  const inner = (
    <>
      <span className="ui-field__url-prefix-badge">{parentPath}</span>
      <span className="ui-field__url-prefix-slash" aria-hidden>
        /
      </span>
    </>
  );

  if (publicHref) {
    return (
      <a
        href={publicHref}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
        onMouseDown={(e) => e.preventDefault()}
      >
        {inner}
      </a>
    );
  }

  return (
    <span className={className} title={title}>
      {inner}
    </span>
  );
}

/** SEO box dùng chung — title → parent → slug → description → rating (không còn từ khóa). */
export function SeoBox({
  value,
  onChange,
  parents = [],
  showParent = true,
  showRating = true,
  slugRequired = true,
  slugHint,
  description = 'Đường dẫn, trang cha (URL phân tầng), meta và schema đánh giá.',
  locale = 'vi',
  defaultLocale = 'vi',
}: Props) {
  const structureLocked = useStructureLocked();
  const selectedParent = parents.find((p) => String(p.id) === String(value.seo_parent_id || ''));
  const preview = buildSlugFullPreview(value.seo_slug || '', selectedParent?.slug_full);
  const publicHref =
    value.seo_slug.trim()
      ? publicPageUrl(preview === '—' ? null : preview, locale, defaultLocale)
      : null;

  return (
    <FormSection
      variant="priority"
      icon={Search}
      title="SEO"
      description={description}
    >
      <FormCluster cols={1}>
        <Input
          label="Tiêu đề SEO"
          name="seo_title"
          value={value.seo_title}
          onChange={(e) => onChange('seo_title', e.target.value)}
          hint="Định dạng: {nội dung 65–85 ký tự} | tên thương hiệu. Tối ưu CTR, không cắt cứng 60 ký tự."
        />

        {showParent ? (
          <Select
            label="Trang cha (phân tầng URL)"
            value={value.seo_parent_id || ''}
            onChange={(v) => onChange('seo_parent_id', v)}
            placeholder="— Không chọn (trang gốc) —"
            searchable
            disabled={structureLocked}
            options={parents.map((p) => ({
              value: String(p.id),
              label: p.label,
            }))}
            hint={
              structureLocked
                ? 'Khóa ở bản dịch — chỉnh trang cha ở ngôn ngữ mặc định.'
                : selectedParent &&
                    (selectedParent.has_locale === false ||
                      (selectedParent.has_locale == null && !String(selectedParent.slug_full || '').trim()))
                  ? `Trang cha chưa có bản dịch «${locale}» — dịch trang cha trước khi lưu bản dịch này.`
                  : 'URL đầy đủ = {parent.slug_full}/{slug}. Ví dụ cha /tours + slug viet-nam → /tours/viet-nam.'
            }
          />
        ) : null}

        <Input
          label="Đường dẫn tĩnh (slug)"
          name="seo_slug"
          value={value.seo_slug}
          onChange={(e) => onChange('seo_slug', e.target.value)}
          required={slugRequired}
          hint={
            slugHint ||
            'Bám tiêu đề SEO — 35–90 ký tự, từ khóa chính, không dấu, ngăn cách `-`.'
          }
          placeholder="vd: thai-lan-10-ngay"
          leading={
            showParent ? (
              <UrlParentPrefix
                parentSlugFull={selectedParent?.slug_full}
                fullPreview={preview}
                publicHref={publicHref}
              />
            ) : undefined
          }
        />

        <Textarea
          label="Mô tả SEO"
          name="seo_description"
          value={value.seo_description}
          onChange={(e) => onChange('seo_description', e.target.value)}
          hint="Mô tả chi tiết trên Google. Thường 200–350 ký tự, đủ ý và hấp dẫn (CTR)."
        />
      </FormCluster>

      {showRating ? (
        <FormCluster title="Schema rating">
          <Input
            label="Điểm đánh giá"
            name="rating_aggregate_star"
            type="number"
            step="0.1"
            min={0}
            max={5}
            value={value.rating_aggregate_star || ''}
            onChange={(e) => onChange('rating_aggregate_star', e.target.value)}
            disabled={structureLocked}
            hint={structureLocked ? 'Khóa ở bản dịch' : 'Schema AggregateRating — AI gợi ý 4.7–4.9'}
          />
          <Input
            label="Lượt đánh giá"
            name="rating_aggregate_count"
            type="number"
            min={0}
            value={value.rating_aggregate_count || ''}
            onChange={(e) => onChange('rating_aggregate_count', e.target.value)}
            disabled={structureLocked}
            hint={
              structureLocked
                ? 'Khóa ở bản dịch'
                : 'Số review schema — AI gợi ý 200–3000 tùy độ hot trang'
            }
          />
        </FormCluster>
      ) : null}
    </FormSection>
  );
}

/** Options Select trạng thái bật/tắt — khớp badge list «Đang bật». */
export const ACTIVE_STATUS_OPTIONS = [
  { value: '1', label: 'Đang bật' },
  { value: '0', label: 'Tắt' },
] as const;

export function activeStatusValue(active: boolean): string {
  return active ? '1' : '0';
}

export function parseActiveStatus(value: string): boolean {
  return value === '1' || value === 'true';
}
