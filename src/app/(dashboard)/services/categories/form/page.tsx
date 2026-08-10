'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from '@/lib/toast';
import { serviceCategoriesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard, FormBannerCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { serviceClusterTitle } from '@/lib/nav';

type FormState = {
  cluster: string;
  name: string;
  intro: string;
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
  cluster: 'experience',
  name: '',
  intro: '',
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

function slugify(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function FormInner() {
  const search = useSearchParams();
  const id = search.get('id') ? Number(search.get('id')) : null;
  const clusterFromUrl = search.get('cluster') || 'experience';
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>({ ...empty, cluster: clusterFromUrl });
  const snapshotRef = useRef(JSON.stringify({ ...empty, cluster: clusterFromUrl }));
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['service-categories-meta', locale, form.cluster],
    queryFn: () => serviceCategoriesApi.meta(locale, form.cluster),
  });
  const detailQuery = useQuery({
    queryKey: ['service-category', id, locale],
    queryFn: () => serviceCategoriesApi.get(id!, locale),
    enabled: !!id,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data;
    const next: FormState = {
      cluster: d.cluster || clusterFromUrl,
      name: d.name || '',
      intro: d.intro || '',
      sort: String(d.sort || 0),
      is_active: !!d.is_active,
      seo_slug: d.seo?.slug || d.slug || '',
      seo_title: d.seo?.title || '',
      seo_description: d.seo?.description || '',
      seo_parent_id: d.seo?.parent_id ? String(d.seo.parent_id) : '',
      rating_aggregate_star:
        d.seo?.rating_aggregate_star != null ? String(d.seo.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.seo?.rating_aggregate_count != null ? String(d.seo.rating_aggregate_count) : '',
      cover: emptyImageField((d as { cover?: never }).cover),
      banner: emptyImageField(d.banner),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data, locale, clusterFromUrl]);

  const save = useMutation({
    mutationFn: async () => {
      const slug = form.seo_slug || slugify(form.name);
      const payload = {
        cluster: form.cluster,
        name: form.name,
        slug,
        intro: form.intro || null,
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
      return isNew
        ? serviceCategoriesApi.create(payload)
        : serviceCategoriesApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo' : 'Đã lưu');
      await qc.invalidateQueries({ queryKey: [`service-categories-${form.cluster}`] });
      await qc.invalidateQueries({ queryKey: ['service-category', data.id] });
      replaceFormUrl(
        router,
        `/services/categories/form/?id=${data.id}&locale=${locale}&cluster=${form.cluster}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));
  const kind = serviceClusterTitle(form.cluster);

  const defaultLocale = String(
    metaQuery.data?.default_locale
    || (detailQuery.data as { default_locale?: string } | undefined)?.default_locale
    || DEFAULT_LOCALE
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'service_category',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await serviceCategoriesApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        name: d.name || '',
        description: d.description || '',
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
          eyebrow={kind}
        title={isNew ? `Thêm danh mục ${kind}` : `Sửa danh mục ${kind}`}
        id={isNew ? null : id}
        actions={
          <HeadActions
            secondary={
              <HeadSecondary
                href={
                  form.cluster
                    ? `/services/categories/?cluster=${form.cluster}`
                    : '/services/categories/'
                }
                icon={ArrowLeft}
                title="Quay lại"
                subtitle="Danh sách"
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
            onChange={(key, v) => setForm((prev) => ({ ...prev, [key]: v }))}
            parents={metaQuery.data?.seo_parents ?? []}
            description="Chọn hub cụm dịch vụ làm trang cha → URL phân tầng."
          />
          <FormSection title="Thông tin">
            <Select
              label="Cụm dịch vụ"
              value={form.cluster}
              onChange={(v) => set('cluster', v)}
              options={(metaQuery.data?.clusters ?? []).map((c) => ({
                value: c.value,
                label: c.label,
              }))}
            />
            <Input
              label="Tên"
              value={form.name}
              onChange={(e) => {
                set('name', e.target.value);
                if (isNew) {
                  set('seo_slug', slugify(e.target.value));
                  if (!form.seo_title) set('seo_title', e.target.value);
                }
              }}
            />
            <Textarea
              label="Giới thiệu"
              value={form.intro}
              onChange={(e) => set('intro', e.target.value)}
            />
            <Input
              label="Thứ tự"
              type="number"
              value={form.sort}
              onChange={(e) => set('sort', e.target.value)}
            disabled={structureLocked}
            />
            <Switch
              label="Đang hoạt động"
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
            />
          </FormSection>

          <FormFooter
            cancelHref={
              form.cluster
                ? `/services/categories/?cluster=${form.cluster}`
                : '/services/categories/'
            }
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
              ariaLabel="Ảnh đại diện danh mục DV"
              folder="service_categories"
              slug={form.seo_slug}
              role="cover"
              aspectRatio="3 / 2"
              variant="card"
              value={form.cover}
              onChange={(v) => set('cover', v)}
            />
          </FormThumbCard>
          <FormBannerCard>
            <ImageField
              ariaLabel="Banner listing danh mục DV"
              folder="service_categories"
              slug={form.seo_slug}
              role="banner"
              aspectRatio="21 / 9"
              variant="lg"
              value={form.banner}
              onChange={(v) => set('banner', v)}
            />
          </FormBannerCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function ServiceCategoryFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
