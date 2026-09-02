'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { homeSectionsApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, lockFormHydration, shouldHydrateScopedQuery, useResetFormOnProjectChange } from '@/hooks/useFormHydration';
import { createScopedQueryFn, useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import { StructureLockProvider, useStructureLocked } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormMediaAside, FormMediaCard } from '@/components/ui/FormMediaAside';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { publicPageUrl } from '@/lib/publicUrl';
import type { LocaleOption } from '@/lib/locale';
import type { MediaImage } from '@/lib/types';
import type { SelectOption } from '@/components/ui/Select';
import {
  FeaturedSelectRepeater,
  featuredPayload,
  mapFeaturedRows,
  type FeaturedIdRow,
} from './FeaturedSelectRepeater';

type Section = {
  id: number;
  key: string;
  label?: string | null;
  is_active: boolean;
  fields?: string[];
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  eyebrow?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  meta_line?: string | null;
  image_alt?: string | null;
  image: ImageFieldState;
};

type UspRow = {
  id?: number;
  icon: string;
  title?: string | null;
  description?: string | null;
};

type FeaturedState = {
  tours: FeaturedIdRow[];
  cruises: FeaturedIdRow[];
  countries: FeaturedIdRow[];
  platforms: FeaturedIdRow[];
  transport: FeaturedIdRow[];
  support: FeaturedIdRow[];
  team: FeaturedIdRow[];
  reviews: FeaturedIdRow[];
  videos: FeaturedIdRow[];
};

const EMPTY_FEATURED: FeaturedState = {
  tours: [],
  cruises: [],
  countries: [],
  platforms: [],
  transport: [],
  support: [],
  team: [],
  reviews: [],
  videos: [],
};

const FIELD_META: Record<string, { label: string; multiline?: boolean }> = {
  eyebrow: { label: 'Nhãn nhỏ' },
  title: { label: 'Tiêu đề' },
  subtitle: { label: 'Phụ đề', multiline: true },
  body: { label: 'Nội dung', multiline: true },
  meta_line: { label: 'Dòng meta / giấy phép' },
  cta_label: { label: 'Nhãn nút CTA' },
  cta_url: { label: 'URL nút CTA' },
  image_alt: { label: 'Alt ảnh minh hoạ' },
};

/** Mô tả box gom copy + danh sách hiển thị. */
const SECTION_DESCRIPTIONS: Record<string, string> = {
  company_intro:
    'Khối giới thiệu công ty — hiển thị Trang chủ + Về chúng tôi (ảnh + nội dung dùng chung).',
  featured_tours:
    'Tiêu đề khối và tour card hiển thị. Để trống danh sách → mặc định; từ mục thứ 4 → slider ngang.',
  featured_cruises:
    'Tiêu đề khối và gói du thuyền / trải nghiệm. Để trống → mặc định; >3 mục → slider.',
  featured_trains:
    'Tiêu đề khối và dịch vụ vé tàu / phà. Để trống → dịch vụ nổi bật; >3 mục → slider.',
  support_services:
    'Tiêu đề khối và dịch vụ bổ trợ. Để trống → 3 hub lưu trú / vui chơi / hỗ trợ; >3 → slider.',
  destinations:
    'Tiêu đề khối và điểm đến (hero + strip). Để trống → tất cả điểm đến; strip >4 → slider.',
  videos:
    'Tiêu đề khối và video thư viện. Để trống → video hiện trang chủ; >4 → slider.',
  team: 'Tiêu đề khối và thành viên đội ngũ. Để trống → thành viên hiện trang chủ; >4 → slider.',
  review_platforms: 'Tiêu đề khối và nền tảng đánh giá hiển thị.',
  testimonials:
    'Tiêu đề khối và cảm nhận khách hàng. Để trống → review hiện trang chủ; hiển thị carousel.',
};

type FeaturedPickerConfig = {
  stateKey: keyof FeaturedState;
  optionsKey: keyof FeaturedOptions;
  selectLabel: string;
  addLabel: string;
  emptyHint: string;
  max?: number;
};

type FeaturedOptions = {
  tours: SelectOption[];
  cruises: SelectOption[];
  countries: SelectOption[];
  platforms: SelectOption[];
  transport: SelectOption[];
  support: SelectOption[];
  team: SelectOption[];
  reviews: SelectOption[];
  videos: SelectOption[];
};

const FEATURED_PICKERS: Record<string, FeaturedPickerConfig> = {
  featured_tours: {
    stateKey: 'tours',
    optionsKey: 'tours',
    selectLabel: 'Chương trình tour',
    addLabel: 'Thêm tour',
    emptyHint: 'Chưa chọn — trang chủ dùng danh sách mặc định.',
  },
  featured_cruises: {
    stateKey: 'cruises',
    optionsKey: 'cruises',
    selectLabel: 'Chương trình du thuyền',
    addLabel: 'Thêm du thuyền',
    emptyHint: 'Chưa chọn — trang chủ dùng danh sách mặc định.',
  },
  featured_trains: {
    stateKey: 'transport',
    optionsKey: 'transport',
    selectLabel: 'Dịch vụ vận chuyển',
    addLabel: 'Thêm dịch vụ',
    emptyHint: 'Chưa chọn — dùng dịch vụ nổi bật / sắp xếp mặc định.',
  },
  support_services: {
    stateKey: 'support',
    optionsKey: 'support',
    selectLabel: 'Dịch vụ bổ trợ',
    addLabel: 'Thêm dịch vụ',
    emptyHint: 'Chưa chọn — giữ hub danh mục mặc định.',
  },
  destinations: {
    stateKey: 'countries',
    optionsKey: 'countries',
    selectLabel: 'Điểm đến',
    addLabel: 'Thêm điểm đến',
    emptyHint: 'Chưa chọn — hiển thị toàn bộ điểm đến đang bật.',
  },
  review_platforms: {
    stateKey: 'platforms',
    optionsKey: 'platforms',
    selectLabel: 'Nền tảng',
    addLabel: 'Thêm nền tảng',
    emptyHint: 'Chưa chọn nền tảng.',
    max: 8,
  },
  videos: {
    stateKey: 'videos',
    optionsKey: 'videos',
    selectLabel: 'Video trải nghiệm',
    addLabel: 'Thêm video',
    emptyHint: 'Chưa chọn — dùng video hiện trang chủ mặc định.',
  },
  team: {
    stateKey: 'team',
    optionsKey: 'team',
    selectLabel: 'Thành viên đội ngũ',
    addLabel: 'Thêm thành viên',
    emptyHint: 'Chưa chọn — dùng đội ngũ hiện trang chủ mặc định.',
  },
  testimonials: {
    stateKey: 'reviews',
    optionsKey: 'reviews',
    selectLabel: 'Cảm nhận / review',
    addLabel: 'Thêm cảm nhận',
    emptyHint: 'Chưa chọn — dùng cảm nhận hiện trang chủ mặc định.',
  },
};

function mapSection(raw: Record<string, unknown>): Section {
  return {
    id: Number(raw.id),
    key: String(raw.key || ''),
    label: (raw.label as string | null) ?? null,
    is_active: !!raw.is_active,
    fields: Array.isArray(raw.fields) ? (raw.fields as string[]) : undefined,
    title: (raw.title as string | null) ?? null,
    subtitle: (raw.subtitle as string | null) ?? null,
    body: (raw.body as string | null) ?? null,
    eyebrow: (raw.eyebrow as string | null) ?? null,
    cta_label: (raw.cta_label as string | null) ?? null,
    cta_url: (raw.cta_url as string | null) ?? null,
    meta_line: (raw.meta_line as string | null) ?? null,
    image_alt: (raw.image_alt as string | null) ?? null,
    image: emptyImageField((raw.image as MediaImage | null | undefined) ?? null),
  };
}

function sectionPayload(s: Section) {
  const fields = s.fields && s.fields.length > 0 ? s.fields : ['eyebrow', 'title', 'subtitle', 'body'];
  const hasImage = fields.includes('image');

  return {
    id: s.id,
    key: s.key,
    is_active: s.is_active,
    eyebrow: s.eyebrow,
    title: s.title,
    subtitle: s.subtitle,
    body: s.body,
    meta_line: s.meta_line,
    cta_label: s.cta_label,
    cta_url: s.cta_url,
    image_alt: s.image_alt,
    ...(hasImage
      ? {
          image_media_id: s.image.media?.id ?? null,
          remove_image: s.image.remove,
        }
      : {}),
  };
}

function asSelectOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as { value?: unknown; label?: unknown };
      if (r.value == null || r.label == null) return null;
      return { value: r.value as string | number, label: String(r.label) };
    })
    .filter(Boolean) as SelectOption[];
}

function HomeSectionEditor({
  section,
  idx,
  featured,
  setFeatured,
  options,
  onChange,
}: {
  section: Section;
  idx: number;
  featured: FeaturedState;
  setFeatured: (patch: Partial<FeaturedState>) => void;
  options: FeaturedOptions;
  onChange: (idx: number, field: string, value: string | boolean | ImageFieldState) => void;
}) {
  const structureLocked = useStructureLocked();
  const fields =
    section.fields && section.fields.length > 0
      ? section.fields
      : ['eyebrow', 'title', 'subtitle', 'body'];
  const hasImage = fields.includes('image');
  const textFields = fields.filter((f) => f !== 'image');
  const picker = FEATURED_PICKERS[section.key];

  return (
    <FormSection
      title={section.label || section.key}
      description={SECTION_DESCRIPTIONS[section.key]}
    >
      <div className={hasImage ? 'ui-form-layout' : undefined}>
        <div className={hasImage ? 'ui-form-layout__main ui-form-stack' : 'ui-form-stack'}>
          <Switch
            label="Đang hoạt động"
            checked={!!section.is_active}
            onChange={(v) => onChange(idx, 'is_active', v)}
          />
          {textFields.map((field) => {
            const meta = FIELD_META[field];
            if (!meta) return null;
            const raw = section[field as keyof Section];
            const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
            if (meta.multiline) {
              return (
                <Textarea
                  key={field}
                  label={meta.label}
                  value={value}
                  onChange={(e) => onChange(idx, field, e.target.value)}
                />
              );
            }
            return (
              <Input
                key={field}
                label={meta.label}
                value={value}
                onChange={(e) => onChange(idx, field, e.target.value)}
              />
            );
          })}

          {picker ? (
            <FeaturedSelectRepeater
              embedded
              clusterTitle="Nội dung hiển thị"
              items={featured[picker.stateKey]}
              onChange={(items) => setFeatured({ [picker.stateKey]: items })}
              options={options[picker.optionsKey]}
              selectLabel={picker.selectLabel}
              addLabel={picker.addLabel}
              emptyHint={picker.emptyHint}
              max={picker.max}
            />
          ) : null}
        </div>

        {hasImage ? (
          <FormMediaAside>
            <FormMediaCard
              title="Ảnh minh hoạ"
              description={
                section.key === 'company_intro'
                  ? 'Dùng chung Trang chủ + Về chúng tôi'
                  : structureLocked
                    ? 'Chỉnh ảnh ở ngôn ngữ mặc định'
                    : 'Thumbnail khối section'
              }
            >
              <ImageField
                ariaLabel={`Ảnh minh hoạ — ${section.label || section.key}`}
                folder="home_sections"
                slug={section.key}
                role="section"
                aspectRatio="4 / 3"
                variant="card"
                disabled={structureLocked}
                value={section.image}
                onChange={(image) => onChange(idx, 'image', image)}
              />
            </FormMediaCard>
          </FormMediaAside>
        ) : null}
      </div>
    </FormSection>
  );
}

export default function HomeContentPage() {
  const qc = useQueryClient();
  const { projectCode } = useAuth();
  const { locale, setLocale } = useEditLocale();
  const [sections, setSections] = useState<Section[]>([]);
  const [usps, setUsps] = useState<UspRow[]>([]);
  const [featured, setFeaturedState] = useState<FeaturedState>(EMPTY_FEATURED);
  const snapshotRef = useRef('');
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = useMemo(
    () => JSON.stringify({ sections, usps, featured }) !== snapshotRef.current,
    [sections, usps, featured],
  );

  const homeQueryKey = useScopedQueryKey('home-sections', locale);

  const query = useQuery({
    queryKey: homeQueryKey,
    queryFn: createScopedQueryFn(() => homeSectionsApi.get(locale)),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const resetForm = useCallback(() => {
    setSections([]);
    setUsps([]);
    setFeaturedState(EMPTY_FEATURED);
    snapshotRef.current = '';
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!query.data) return;
    if (!shouldHydrateScopedQuery(homeQueryKey, projectCode)) return;
    if (!beginFormHydration(hydrateKeyRef, 'home', locale)) return;
    const d = query.data as Record<string, unknown>;
    const nextSections = ((d.sections as Record<string, unknown>[]) || []).map(mapSection);
    const nextUsps = (d.usps as UspRow[]) || [];
    const nextFeatured: FeaturedState = {
      tours: mapFeaturedRows(d.featured_tours as Record<string, unknown>[], 'package_id'),
      cruises: mapFeaturedRows(d.featured_cruises as Record<string, unknown>[], 'package_id'),
      countries: mapFeaturedRows(d.featured_countries as Record<string, unknown>[], 'country_id'),
      platforms: mapFeaturedRows(
        d.featured_platforms as Record<string, unknown>[],
        'review_platform_id',
      ),
      transport: mapFeaturedRows(d.featured_transport as Record<string, unknown>[], 'service_id'),
      support: mapFeaturedRows(d.featured_support as Record<string, unknown>[], 'service_id'),
      team: mapFeaturedRows(d.featured_team_members as Record<string, unknown>[], 'team_member_id'),
      reviews: mapFeaturedRows(d.featured_reviews as Record<string, unknown>[], 'review_id'),
      videos: mapFeaturedRows(
        d.featured_videos as Record<string, unknown>[],
        'experience_video_id',
      ),
    };
    setSections(nextSections);
    setUsps(nextUsps);
    setFeaturedState(nextFeatured);
    snapshotRef.current = JSON.stringify({
      sections: nextSections,
      usps: nextUsps,
      featured: nextFeatured,
    });
  }, [query.data, projectCode, locale]);

  const options = useMemo(
    (): FeaturedOptions => ({
      tours: asSelectOptions((query.data as Record<string, unknown> | undefined)?.tour_options),
      cruises: asSelectOptions((query.data as Record<string, unknown> | undefined)?.cruise_options),
      countries: asSelectOptions(
        (query.data as Record<string, unknown> | undefined)?.country_options,
      ),
      platforms: asSelectOptions(
        (query.data as Record<string, unknown> | undefined)?.platform_options,
      ),
      transport: asSelectOptions(
        (query.data as Record<string, unknown> | undefined)?.transport_service_options,
      ),
      support: asSelectOptions(
        (query.data as Record<string, unknown> | undefined)?.support_service_options,
      ),
      team: asSelectOptions(
        (query.data as Record<string, unknown> | undefined)?.team_member_options,
      ),
      reviews: asSelectOptions((query.data as Record<string, unknown> | undefined)?.review_options),
      videos: asSelectOptions((query.data as Record<string, unknown> | undefined)?.video_options),
    }),
    [query.data],
  );

  const setFeatured = (patch: Partial<FeaturedState>) => {
    setFeaturedState((prev) => ({ ...prev, ...patch }));
  };

  const save = useMutation({
    mutationFn: () =>
      homeSectionsApi.update({
        locale,
        sections: sections.map(sectionPayload),
        usps,
        pills: (query.data as { pills?: unknown[] })?.pills || [],
        featured_tours: featuredPayload(featured.tours, 'package_id'),
        featured_cruises: featuredPayload(featured.cruises, 'package_id'),
        featured_countries: featuredPayload(featured.countries, 'country_id'),
        featured_platforms: featuredPayload(featured.platforms, 'review_platform_id'),
        featured_transport: featuredPayload(featured.transport, 'service_id'),
        featured_support: featuredPayload(featured.support, 'service_id'),
        featured_team_members: featuredPayload(featured.team, 'team_member_id'),
        featured_reviews: featuredPayload(featured.reviews, 'review_id'),
        featured_videos: featuredPayload(featured.videos, 'experience_video_id'),
      }),
    onSuccess: async () => {
      toast.success('Đã lưu nội dung trang chủ');
      snapshotRef.current = JSON.stringify({ sections, usps, featured });
      lockFormHydration(hydrateKeyRef, 'home', locale);
      await qc.invalidateQueries({ queryKey: homeQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const languages = ((query.data as { languages?: LocaleOption[] } | undefined)?.languages) ?? [];
  const defaultLocale = String(
    (query.data as { default_locale?: string } | undefined)?.default_locale || DEFAULT_LOCALE,
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'home_sections',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () =>
      pickTranslatableFields({
        sections: sections.map(({ image: _img, ...rest }) => rest) as unknown as Record<
          string,
          unknown
        >[],
        usps: usps as unknown as Record<string, unknown>[],
      } as Record<string, unknown>),
    getSourceFields: async () => {
      const d = (await homeSectionsApi.get(defaultLocale)) as {
        sections?: Record<string, unknown>[];
        usps?: UspRow[];
      };
      return pickTranslatableFields({
        sections: (d.sections || []).map((raw) => {
          const { image: _img, ...rest } = mapSection(raw);
          return rest;
        }) as unknown as Record<string, unknown>[],
        usps: (d.usps || []) as unknown as Record<string, unknown>[],
      } as Record<string, unknown>);
    },
    applyFields: (fields) => {
      const stripped = sections.map(({ image, ...rest }) => rest);
      const merged = mergeTranslatedFields(
        { sections: stripped, usps } as unknown as Record<string, unknown>,
        fields,
      ) as { sections: Omit<Section, 'image'>[]; usps: UspRow[] };
      if (merged.sections) {
        setSections((prev) =>
          merged.sections.map((row, i) => ({
            ...row,
            image: prev[i]?.image ?? emptyImageField(),
          })),
        );
      }
      if (merged.usps) setUsps(merged.usps);
    },
  });

  const setSectionField = (
    idx: number,
    field: string,
    value: string | boolean | ImageFieldState,
  ) => {
    setSections((prev) => prev.map((x, i) => (i === idx ? { ...x, [field]: value } : x)));
  };

  return (
    <StructureLockProvider locked={structureLocked}>
      <div>
        <PageHeader
          eyebrow="Nội dung"
          title="Nội dung trang chủ"
          description="Mỗi khối gom tiêu đề/copy và danh sách hiển thị (nếu có) trong một box. Để trống danh sách → public dùng mặc định."
        />
        <LocaleSwitcher
          languages={languages}
          value={locale}
          onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty })}
        />
        <StructureNotice />
        {query.isError ? (
          <p className="ui-form-error" role="alert">
            Không tải được cấu hình trang chủ
            {query.error instanceof Error ? `: ${query.error.message}` : ''}. Thử tải lại trang.
          </p>
        ) : null}
        {query.isLoading && sections.length === 0 ? (
          <p className="body-text text-muted">Đang tải…</p>
        ) : null}
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="ui-form-stack"
        >
          {sections.map((s, idx) => (
            <HomeSectionEditor
              key={s.id}
              section={s}
              idx={idx}
              featured={featured}
              setFeatured={setFeatured}
              options={options}
              onChange={setSectionField}
            />
          ))}
          <FormSection title="Điểm nổi bật (USP)" description="4 cam kết dịch vụ dưới hero.">
            {usps.map((u, idx) => (
              <div key={u.id || idx} className="ui-form-substack">
                <Input
                  label="Mã icon"
                  value={u.icon}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, icon: e.target.value } : x)),
                    )
                  }
                  disabled={structureLocked}
                />
                <Input
                  label="Tiêu đề"
                  value={u.title || ''}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <Textarea
                  label="Mô tả"
                  value={u.description || ''}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
              </div>
            ))}
          </FormSection>
          <FormFooter loading={save.isPending} viewHref={publicPageUrl('/', locale)} />
        </form>
      </div>
    </StructureLockProvider>
  );
}
