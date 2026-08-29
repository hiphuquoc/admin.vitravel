'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderTree } from 'lucide-react';
import toast from '@/lib/toast';
import { categoriesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, markFormHydrationStale } from '@/hooks/useFormHydration';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Select, Switch } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { AiEnrichListingButton } from '@/components/ui/AiEnrichListingButton';
import { mergeListingEnrichFields } from '@/lib/aiEnrichFields';
import { ListingChromeCopyFields } from '@/components/ui/ListingChromeCopyFields';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { ViewPublicButton } from '@/components/ui/ViewPublicButton';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';

type FormState = {
  name: string;
  type: string;
  country_id: string;
  sort: string;
  is_active: boolean;
  description: string;
  seo_intro: string;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_parent_id: string;
  rating_aggregate_star: string;
  rating_aggregate_count: string;
  cover: ImageFieldState;
};

const empty: FormState = {
  name: '',
  type: 'theme',
  country_id: '',
  sort: '0',
  is_active: true,
  description: '',
  seo_intro: '',
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_parent_id: '',
  rating_aggregate_star: '',
  rating_aggregate_count: '',
  cover: emptyImageField(),
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

function CategoryFormInner() {
  const search = useSearchParams();
  const idParam = search.get('id');
  const id = idParam ? Number(idParam) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [listingEditorEpoch, setListingEditorEpoch] = useState(0);
  const snapshotRef = useRef(JSON.stringify(empty));
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['tour-categories-meta', locale],
    queryFn: () => categoriesApi.meta(locale),
  });

  const detailQuery = useQuery({
    queryKey: ['tour-category', id, locale],
    queryFn: () => categoriesApi.get(id!, locale),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;
    const d = detailQuery.data;
    const next: FormState = {
      name: d.name || '',
      type: d.type || 'theme',
      country_id: d.country_id ? String(d.country_id) : '',
      sort: String(d.sort || 0),
      is_active: !!d.is_active,
      description: d.description || '',
      seo_intro: d.seo_intro || '',
      seo_slug: d.seo?.slug || d.slug || '',
      seo_title: d.seo?.title || '',
      seo_description: d.seo?.description || '',
      seo_parent_id: d.seo?.parent_id ? String(d.seo.parent_id) : '',
      rating_aggregate_star:
        d.seo?.rating_aggregate_star != null ? String(d.seo.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.seo?.rating_aggregate_count != null ? String(d.seo.rating_aggregate_count) : '',
      cover: emptyImageField(d.cover ?? null),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
    setSlugTouched(true);
  }, [detailQuery.data, locale]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.seo_slug || slugify(form.name),
        type: form.type,
        country_id: form.country_id ? Number(form.country_id) : null,
        sort: Number(form.sort) || 0,
        is_active: form.is_active,
        description: form.description || null,
        seo_intro: form.seo_intro || null,
        seo_slug: form.seo_slug || slugify(form.name),
        seo_title: form.seo_title || form.name,
        seo_description: form.seo_description || null,
        seo_parent_id: form.seo_parent_id ? Number(form.seo_parent_id) : null,
        rating_aggregate_star: form.rating_aggregate_star
          ? Number(form.rating_aggregate_star)
          : null,
        rating_aggregate_count: form.rating_aggregate_count
          ? Number(form.rating_aggregate_count)
          : null,
        cover_media_id: form.cover.media?.id ?? null,
        remove_cover: form.cover.remove,
        locale,
      };
      return isNew ? categoriesApi.create(payload) : categoriesApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo danh mục' : 'Đã lưu danh mục');
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: ['tour-categories'] });
      replaceFormUrl(router, `/tours/categories/form/?id=${data.id}&locale=${locale}`);
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
    entityType: 'tour_category',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await categoriesApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        name: d.name || '',
        description: d.description || '',
        seo_intro: d.seo_intro || '',
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
          eyebrow="Tour"
        title={isNew ? 'Thêm chủ đề' : 'Chỉnh sửa chủ đề'}
        id={isNew ? null : id}
        description={isNew ? 'Tạo chủ đề lọc cho listing tour.' : undefined}
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
                href="/tours/categories/"
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
          description="Chọn hub Tour làm trang cha (không chọn điểm đến / chủ đề khác — cùng cấp). URL = {hub}/{slug}."
        />

        <FormSection
          icon={FolderTree}
          title="Thông tin chủ đề"
          description="Tên, loại và gắn quốc gia (select đơn)."
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
          </FormCluster>

          <FormCluster title="Phân loại">
            <Select
              label="Loại"
              value={form.type}
              onChange={(v) => set('type', v)}
              required
              options={(metaQuery.data?.type_options ?? []).map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
            <Select
              label="Quốc gia (lọc taxonomy, không phải trang cha SEO)"
              value={form.country_id}
              onChange={(v) => set('country_id', v)}
              placeholder="Không gắn quốc gia"
              searchable
              options={(metaQuery.data?.countries ?? []).map((c) => ({
                value: c.id,
                label: c.name || `#${c.id}`,
              }))}
            disabled={structureLocked}
            />
            <Input label="Thứ tự" type="number" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
            <Switch
              label="Đang hoạt động"
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
            />
          </FormCluster>

          <FormCluster cols={1} title="Nội dung listing">
            <ListingChromeCopyFields
              subtitle={form.description}
              seoBody={form.seo_intro}
              subtitleName="description"
              seoBodyName="seo_intro"
              editorEpoch={listingEditorEpoch}
              onSubtitleChange={(v) => set('description', v)}
              onSeoBodyChange={(v) => set('seo_intro', v)}
            />
          </FormCluster>
        </FormSection>

        <FormFooter
          cancelHref="/tours/categories/"
          loading={save.isPending}
          viewHref={publicPageUrl(
            detailQuery.data?.seo?.slug_full,
            locale,
            metaQuery.data?.default_locale || 'vi',
          )}
          preActions={
            <AiEnrichListingButton
              entityType="tour_category"
              locale={locale}
              getForm={() => form as unknown as Record<string, unknown>}
              applyFields={(fields) => {
                setForm((prev) =>
                  mergeListingEnrichFields(
                    prev as unknown as Record<string, unknown>,
                    fields,
                    'tour_category',
                  ) as FormState,
                );
                setListingEditorEpoch((n) => n + 1);
              }}
            />
          }
        />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện danh mục"
              folder="tour_categories"
              slug={form.seo_slug}
              role="cover"
              aspectRatio="3 / 2"
              variant="card"
              value={form.cover}
              onChange={(cover) => set('cover', cover)}
            />
          </FormThumbCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function CategoryFormPage() {
  return (
    <Suspense fallback={<div>Đang tải form…</div>}>
      <CategoryFormInner />
    </Suspense>
  );
}
