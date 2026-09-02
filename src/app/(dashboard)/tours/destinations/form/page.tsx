'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Globe2 } from 'lucide-react';
import toast from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { countriesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, lockFormHydration, shouldHydrateScopedQuery, useResetFormOnProjectChange } from '@/hooks/useFormHydration';
import { createScopedQueryFn, useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { Input, Select, Switch } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard, FormBannerCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { AiEnrichListingButton } from '@/components/ui/AiEnrichListingButton';
import { mergeListingEnrichFields } from '@/lib/aiEnrichFields';
import { ListingChromeCopyFields } from '@/components/ui/ListingChromeCopyFields';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { ViewPublicButton } from '@/components/ui/ViewPublicButton';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';

type FormState = {
  code: string;
  name: string;
  tagline: string;
  intro_text: string;
  long_form_content: string;
  sort: string;
  home_grid_size: string;
  is_active: boolean;
  show_in_menu: boolean;
  show_in_customize_form: boolean;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  seo_parent_id: string;
  rating_aggregate_star: string;
  rating_aggregate_count: string;
  banner: ImageFieldState;
  listing_banner: ImageFieldState;
};

const empty: FormState = {
  code: '',
  name: '',
  tagline: '',
  intro_text: '',
  long_form_content: '',
  sort: '0',
  home_grid_size: 'medium',
  is_active: true,
  show_in_menu: true,
  show_in_customize_form: true,
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  seo_parent_id: '',
  rating_aggregate_star: '',
  rating_aggregate_count: '',
  banner: emptyImageField(),
  listing_banner: emptyImageField(),
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

function FormInner() {
  const search = useSearchParams();
  const id = search.get('id') ? Number(search.get('id')) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { projectCode } = useAuth();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const [listingEditorEpoch, setListingEditorEpoch] = useState(0);
  const snapshotRef = useRef(JSON.stringify(empty));
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['countries-meta', locale],
    queryFn: () => countriesApi.meta(locale),
  });
  const detailQueryKey = useScopedQueryKey('country', id, locale);

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: createScopedQueryFn(() => countriesApi.get(id!, locale)),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const resetForm = useCallback(() => {
    setForm(empty);
    snapshotRef.current = JSON.stringify(empty);
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!detailQuery.data) return;
    if (!shouldHydrateScopedQuery(detailQueryKey, projectCode)) return;
    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;
    const d = detailQuery.data;
    const next: FormState = {
      code: d.code || '',
      name: d.name || '',
      tagline: d.tagline || '',
      intro_text: d.intro_text || '',
      long_form_content: d.long_form_content || d.intro_text || '',
      sort: String(d.sort || 0),
      home_grid_size: d.home_grid_size || 'medium',
      is_active: !!d.is_active,
      show_in_menu: !!d.show_in_menu,
      show_in_customize_form: !!d.show_in_customize_form,
      seo_slug: d.seo?.slug || d.slug || '',
      seo_title: d.seo?.title || '',
      seo_description: d.seo?.description || '',
      seo_keywords: d.seo?.keywords || '',
      seo_parent_id: d.seo?.parent_id
        ? String(d.seo.parent_id)
        : metaQuery.data?.hub_seo_id
          ? String(metaQuery.data.hub_seo_id)
          : '',
      rating_aggregate_star:
        d.seo?.rating_aggregate_star != null ? String(d.seo.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.seo?.rating_aggregate_count != null ? String(d.seo.rating_aggregate_count) : '',
      banner: emptyImageField(d.banner),
      listing_banner: emptyImageField(d.listing_banner),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data, projectCode, locale, metaQuery.data?.hub_seo_id]);

  useEffect(() => {
    if (!isNew || form.seo_parent_id || !metaQuery.data?.hub_seo_id) return;
    setForm((prev) => ({ ...prev, seo_parent_id: String(metaQuery.data!.hub_seo_id) }));
  }, [isNew, form.seo_parent_id, metaQuery.data?.hub_seo_id]);

  const save = useMutation({
    mutationFn: async () => {
      const slug = form.seo_slug || slugify(form.name);
      const payload = {
        code: form.code,
        name: form.name,
        slug,
        tagline: form.tagline || null,
        intro_text: form.intro_text || null,
        long_form_content: form.long_form_content || null,
        sort: Number(form.sort) || 0,
        home_grid_size: form.home_grid_size,
        is_active: form.is_active,
        show_in_menu: form.show_in_menu,
        show_in_customize_form: form.show_in_customize_form,
        seo_slug: slug,
        seo_title: form.seo_title || form.name,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
        seo_parent_id: form.seo_parent_id ? Number(form.seo_parent_id) : null,
        rating_aggregate_star: form.rating_aggregate_star
          ? Number(form.rating_aggregate_star)
          : null,
        rating_aggregate_count: form.rating_aggregate_count
          ? Number(form.rating_aggregate_count)
          : null,
        banner_media_id: form.banner.media?.id ?? null,
        remove_banner: form.banner.remove,
        listing_banner_media_id: form.listing_banner.media?.id ?? null,
        remove_listing_banner: form.listing_banner.remove,
        locale,
      };
      return isNew ? countriesApi.create(payload) : countriesApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo' : 'Đã lưu');
      snapshotRef.current = JSON.stringify(form);
      lockFormHydration(hydrateKeyRef, id ?? data.id, locale);
      await qc.invalidateQueries({ queryKey: detailQueryKey });
      await qc.invalidateQueries({ queryKey: [projectCode, 'countries'] });
      replaceFormUrl(router, `/tours/destinations/form/?id=${data.id}&locale=${locale}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const defaultLocale = metaQuery.data?.default_locale || DEFAULT_LOCALE;
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'country',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await countriesApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        name: d.name || '',
        tagline: d.tagline || '',
        intro_text: d.intro_text || '',
        long_form_content: d.long_form_content || '',
        seo_slug: d.seo?.slug || d.slug || '',
        seo_title: d.seo?.title || '',
        seo_description: d.seo?.description || '',
      });
    },
    applyFields: (fields) =>
      setForm((prev) =>
        mergeTranslatedFields(prev as unknown as Record<string, unknown>, fields) as FormState,
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
        title={isNew ? 'Thêm danh mục Tour' : 'Chỉnh sửa danh mục Tour'}
        id={isNew ? null : id}
        description={isNew ? 'Quốc gia / điểm đến — SEO parent cho gói tour.' : undefined}
        actions={
          <HeadActions
            primary={
              <ViewPublicButton
                href={publicPageUrl(
                  detailQuery.data?.seo?.slug_full,
                  locale,
                  defaultLocale,
                )}
              />
            }
            secondary={
              <HeadSecondary
                href="/tours/destinations/"
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
        onChange={(code) => {
          if (isNew && !isDefaultLocale(code, defaultLocale)) {
            toast.error('Tạo mới chỉ ở ngôn ngữ mặc định. Lưu xong rồi dịch.');
            return;
          }
          setLocale(code, { confirmIfDirty: true, isDirty });
        }}
        translatedLocales={detailQuery.data?.translated_locales ?? (isNew ? [] : undefined)}
      />
      <StructureNotice />
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (isNew && structureLocked) {
            toast.error('Tạo mới chỉ ở ngôn ngữ mặc định. Lưu xong rồi dịch.');
            return;
          }
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
            locale={locale}
            defaultLocale={defaultLocale}
            description="Chọn Hub Tour làm trang cha → URL = /tours/{slug}."
          />

          <FormSection
            icon={Globe2}
            title="Thông tin danh mục"
            description="Quốc gia / điểm đến — SEO parent cho gói tour."
          >
            <FormCluster title="Định danh">
              <Input
                label="Mã"
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                disabled={structureLocked}
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
              <Input
                label="Thứ tự"
                type="number"
                value={form.sort}
                onChange={(e) => set('sort', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>

            <FormCluster title="Hiển thị">
              <Select
                label="Lưới trang chủ"
                value={form.home_grid_size}
                onChange={(v) => set('home_grid_size', v)}
                disabled={structureLocked}
                options={(metaQuery.data?.home_grid_sizes ?? []).map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
              />
              <Switch
                label="Đang hoạt động"
                checked={form.is_active}
                onChange={(v) => set('is_active', v)}
              />
            </FormCluster>

            <div className="ui-form-flags">
              <Switch
                label="Hiện trên menu"
                checked={form.show_in_menu}
                onChange={(v) => set('show_in_menu', v)}
              />
              <Switch
                label="Hiện form tùy chỉnh"
                checked={form.show_in_customize_form}
                onChange={(v) => set('show_in_customize_form', v)}
              />
            </div>

            <FormCluster cols={1} title="Nội dung listing">
              <ListingChromeCopyFields
                subtitle={form.tagline}
                seoBody={form.long_form_content}
                subtitleName="tagline"
                seoBodyName="long_form_content"
                editorEpoch={listingEditorEpoch}
                onSubtitleChange={(v) => set('tagline', v)}
                onSeoBodyChange={(v) => set('long_form_content', v)}
              />
            </FormCluster>
          </FormSection>

          <FormFooter
            cancelHref="/tours/destinations/"
            loading={save.isPending}
            viewHref={publicPageUrl(
              detailQuery.data?.seo?.slug_full,
              locale,
              defaultLocale,
            )}
            preActions={
              <AiEnrichListingButton
                entityType="country"
                locale={locale}
                getForm={() => form as unknown as Record<string, unknown>}
                applyFields={(fields) => {
                  setForm((prev) =>
                    mergeListingEnrichFields(
                      prev as unknown as Record<string, unknown>,
                      fields,
                      'country',
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
              ariaLabel="Ảnh đại diện"
              folder="countries"
              slug={form.seo_slug}
              role="cover"
              aspectRatio="3 / 2"
              variant="card"
              value={form.banner}
              onChange={(v) => set('banner', v)}
            />
          </FormThumbCard>
          <FormBannerCard description="Hero /tours/{slug}">
            <ImageField
              ariaLabel="Banner listing"
              folder="countries"
              slug={form.seo_slug}
              role="banner"
              aspectRatio="21 / 9"
              variant="lg"
              value={form.listing_banner}
              onChange={(v) => set('listing_banner', v)}
            />
          </FormBannerCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function DestinationFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
