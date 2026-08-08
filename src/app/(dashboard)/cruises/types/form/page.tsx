'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Anchor, ArrowLeft } from 'lucide-react';
import toast from '@/lib/toast';
import { cruiseTypesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Switch } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard, FormBannerCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { ViewPublicButton } from '@/components/ui/ViewPublicButton';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';

type FormState = {
  name: string;
  sort: string;
  is_active: boolean;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_parent_id: string;
  rating_aggregate_star: string;
  rating_aggregate_count: string;
  cover: ImageFieldState;
  banner: ImageFieldState;
};

const empty: FormState = {
  name: '',
  sort: '0',
  is_active: true,
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_parent_id: '',
  rating_aggregate_star: '',
  rating_aggregate_count: '',
  cover: emptyImageField(),
  banner: emptyImageField(),
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function CruiseTypeFormInner() {
  const search = useSearchParams();
  const idParam = search.get('id');
  const id = idParam ? Number(idParam) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const snapshotRef = useRef(JSON.stringify(empty));
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['cruise-types-meta', locale],
    queryFn: () => cruiseTypesApi.meta(locale),
  });

  const detailQuery = useQuery({
    queryKey: ['cruise-type', id, locale],
    queryFn: () => cruiseTypesApi.get(id!, locale),
    enabled: !!id,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data;
    const next: FormState = {
      name: d.name || '',
      sort: String(d.sort || 0),
      is_active: !!d.is_active,
      seo_slug: d.seo?.slug || d.slug || '',
      seo_title: d.seo?.title || '',
      seo_description: d.seo?.description || '',
      seo_parent_id: d.seo?.parent_id
        ? String(d.seo.parent_id)
        : metaQuery.data?.hub_seo_id
          ? String(metaQuery.data.hub_seo_id)
          : '',
      rating_aggregate_star:
        d.seo?.rating_aggregate_star != null ? String(d.seo.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.seo?.rating_aggregate_count != null ? String(d.seo.rating_aggregate_count) : '',
      cover: emptyImageField(d.cover ?? null),
      banner: emptyImageField(d.banner ?? null),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
    setSlugTouched(true);
  }, [detailQuery.data, locale, metaQuery.data?.hub_seo_id]);

  useEffect(() => {
    if (!isNew || form.seo_parent_id || !metaQuery.data?.hub_seo_id) return;
    setForm((prev) => ({ ...prev, seo_parent_id: String(metaQuery.data!.hub_seo_id) }));
  }, [isNew, form.seo_parent_id, metaQuery.data?.hub_seo_id]);

  const save = useMutation({
    mutationFn: async () => {
      const slug = form.seo_slug || slugify(form.name);
      const payload = {
        name: form.name,
        slug,
        sort: Number(form.sort) || 0,
        is_active: form.is_active,
        seo_slug: slug,
        seo_title: form.seo_title || form.name,
        seo_description: form.seo_description || null,
        seo_parent_id: form.seo_parent_id ? Number(form.seo_parent_id) : null,
        rating_aggregate_star: form.rating_aggregate_star
          ? Number(form.rating_aggregate_star)
          : null,
        rating_aggregate_count: form.rating_aggregate_count
          ? Number(form.rating_aggregate_count)
          : null,
        banner_media_id: form.banner.media?.id ?? null,
        remove_banner: form.banner.remove,
        cover_media_id: form.cover.media?.id ?? null,
        remove_cover: form.cover.remove,
        locale,
      };
      return isNew ? cruiseTypesApi.create(payload) : cruiseTypesApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo loại du thuyền' : 'Đã lưu loại du thuyền');
      await qc.invalidateQueries({ queryKey: ['cruise-types'] });
      await qc.invalidateQueries({ queryKey: ['packages-meta'] });
      replaceFormUrl(router, `/cruises/types/form/?id=${data.id}&locale=${locale}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const defaultLocale = String(
    metaQuery.data?.default_locale
    || (detailQuery.data as { default_locale?: string } | undefined)?.default_locale
    || DEFAULT_LOCALE
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'cruise_type',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await cruiseTypesApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        name: d.name || '',
        seo_slug: d.seo?.slug || d.slug || '',
        seo_title: d.seo?.title || '',
        seo_description: d.seo?.description || '',
      });
    },
    applyFields: (fields) =>
      setForm((prev) =>
        mergeTranslatedFields(prev as unknown as Record<string, unknown>, fields) as typeof prev,
      ),
  });

  return (
    <StructureLockProvider
      locked={structureLocked}
      locale={locale}
      defaultLocale={defaultLocale}
      seoParentId={form.seo_parent_id}
      seoParents={metaQuery.data?.seo_parents ?? []}
    >
    <div>
        <PageHeader
          eyebrow="Du thuyền"
        title={isNew ? 'Thêm danh mục Du thuyền' : 'Chỉnh sửa danh mục Du thuyền'}
        id={isNew ? null : id}
        description={isNew ? 'Danh mục cruise làm SEO parent cho chi tiết du thuyền.' : undefined}
        actions={
          <HeadActions
            primary={
              <ViewPublicButton
                href={publicPageUrl(
                  detailQuery.data?.seo?.slug_full,
                  locale,
                  metaQuery.data?.default_locale || 'vi',
                )}
              />
            }
            secondary={
              <HeadSecondary
                href="/cruises/types/"
                icon={ArrowLeft}
                title="Quay lại"
                subtitle="Về danh sách"
              />
            }
          />
        }
      />

      <LocaleSwitcher
        languages={metaQuery.data?.languages ?? []}
        value={locale}
        onChange={(code) => setLocale(code, { confirmIfDirty: true, isDirty })}
        translatedLocales={detailQuery.data?.translated_locales ?? (isNew ? [] : undefined)}
        hint={`Đang chỉnh bản dịch: ${locale.toUpperCase()} — tab cam = đang chọn · xám = chưa có bản dịch.`}
      />
      <StructureNotice />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
        className="ui-form-layout"
      >
        <div className="ui-form-layout__main ui-form-stack">
        <SeoBox
          value={{
            seo_title: form.seo_title,
            seo_slug: form.seo_slug,
            seo_description: form.seo_description,
            seo_parent_id: form.seo_parent_id,
            rating_aggregate_star: form.rating_aggregate_star,
            rating_aggregate_count: form.rating_aggregate_count,
          }}
          onChange={(key, v) => {
            if (key === 'seo_slug') setSlugTouched(true);
            setForm((prev) => ({ ...prev, [key]: v }));
          }}
          parents={metaQuery.data?.seo_parents ?? []}
          slugHint="Khớp packages.cruise_type và seo_slug"
          description="Chọn Hub Cruise làm trang cha → URL = /cruises/{slug}."
        />

        <FormSection
          icon={Anchor}
          title="Thông tin danh mục"
          description="Tên hiển thị và thứ tự listing."
        >
          <FormCluster title="Định danh">
            <Input
              label="Tên"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                set('name', name);
                if (!slugTouched) set('seo_slug', slugify(name));
              }}
              required
            />
            <Input
              label="Thứ tự"
              type="number"
              value={form.sort}
              onChange={(e) => set('sort', e.target.value)}
            disabled={structureLocked}
            />
          </FormCluster>
          <FormCluster>
            <Switch
              label="Đang hoạt động"
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
            />
          </FormCluster>
        </FormSection>

        <FormFooter
          cancelHref="/cruises/types/"
          submitLabel="Lưu danh mục Du thuyền"
          loading={save.isPending}
          viewHref={publicPageUrl(
            detailQuery.data?.seo?.slug_full,
            locale,
            metaQuery.data?.default_locale || 'vi',
          )}
        />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện loại du thuyền"
              folder="cruise_types"
              slug={form.seo_slug}
              role="cover"
              aspectRatio="3 / 2"
              variant="card"
              value={form.cover}
              onChange={(cover) => set('cover', cover)}
            />
          </FormThumbCard>
          <FormBannerCard>
            <ImageField
              ariaLabel="Banner listing loại du thuyền"
              folder="cruise_types"
              slug={form.seo_slug}
              role="banner"
              aspectRatio="21 / 9"
              variant="lg"
              value={form.banner}
              onChange={(banner) => set('banner', banner)}
            />
          </FormBannerCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function CruiseTypeFormPage() {
  return (
    <Suspense fallback={<div>Đang tải form…</div>}>
      <CruiseTypeFormInner />
    </Suspense>
  );
}
