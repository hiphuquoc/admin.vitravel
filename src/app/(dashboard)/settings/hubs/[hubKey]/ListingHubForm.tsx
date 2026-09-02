'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import toast from '@/lib/toast';
import { listingHubsApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { beginFormHydration, markFormHydrationStale, useResetFormOnProjectChange } from '@/hooks/useFormHydration';
import { useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard, FormBannerCard } from '@/components/ui/FormMediaAside';
import { FormFooter } from '@/components/ui/FormFooter';
import { AiEnrichListingButton } from '@/components/ui/AiEnrichListingButton';
import { mergeListingEnrichFields } from '@/lib/aiEnrichFields';
import { ListingChromeCopyFields } from '@/components/ui/ListingChromeCopyFields';
import { ViewPublicButton } from '@/components/ui/ViewPublicButton';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { publicPageUrl } from '@/lib/publicUrl';
import { listingHubNavLabel } from '@/lib/nav';
import type { LocaleOption } from '@/lib/locale';

type FormState = {
  title: string;
  body: string;
  seo_body: string;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  rating_aggregate_star: string;
  rating_aggregate_count: string;
  cover: ImageFieldState;
  banner: ImageFieldState;
};

const empty: FormState = {
  title: '',
  body: '',
  seo_body: '',
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  rating_aggregate_star: '',
  rating_aggregate_count: '',
  cover: emptyImageField(),
  banner: emptyImageField(),
};

export default function ListingHubForm() {
  const params = useParams<{ hubKey: string }>();
  const hubKey = params.hubKey;
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const [listingEditorEpoch, setListingEditorEpoch] = useState(0);
  const snapshotRef = useRef(JSON.stringify(empty));
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const hubQueryKey = useScopedQueryKey('listing-hub', hubKey, locale);

  const query = useQuery({
    queryKey: hubQueryKey,
    queryFn: () => listingHubsApi.get(hubKey, locale),
    enabled: !!hubKey,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const resetForm = useCallback(() => {
    setForm(empty);
    snapshotRef.current = JSON.stringify(empty);
    setListingEditorEpoch((n) => n + 1);
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!query.data) return;
    if (!beginFormHydration(hydrateKeyRef, hubKey, locale)) return;
    const d = query.data as Record<string, unknown>;
    const next: FormState = {
      title: String(d.title || ''),
      body: String(d.body || ''),
      seo_body: String(d.seo_body || ''),
      seo_slug: String(d.seo_slug || ''),
      seo_title: String(d.seo_title || ''),
      seo_description: String(d.seo_description || ''),
      seo_keywords: String(d.seo_keywords || ''),
      rating_aggregate_star:
        d.rating_aggregate_star != null ? String(d.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.rating_aggregate_count != null ? String(d.rating_aggregate_count) : '',
      cover: emptyImageField(d.cover as never),
      banner: emptyImageField(d.banner as never),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      listingHubsApi.update(hubKey, {
        ...form,
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
      }),
    onSuccess: async () => {
      toast.success('Đã lưu hub');
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: ['listing-hub', hubKey] });
      snapshotRef.current = JSON.stringify(form);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const languages = ((query.data as { languages?: LocaleOption[] } | undefined)?.languages) ?? [];
  const label = listingHubNavLabel(hubKey);
  const defaultLocale = String(
    (query.data as { default_locale?: string } | undefined)?.default_locale || 'vi',
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const structureLocked = !isDefaultLocale(locale, String(defaultLocale));

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: 'listing_hub',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      const d = (await listingHubsApi.get(hubKey, defaultLocale)) as Record<string, unknown>;
      return pickTranslatableFields({
        title: String(d.title || ''),
        body: String(d.body || ''),
        seo_body: String(d.seo_body || ''),
        seo_slug: String(d.seo_slug || ''),
        seo_title: String(d.seo_title || ''),
        seo_description: String(d.seo_description || ''),
        seo_keywords: String(d.seo_keywords || ''),
      });
    },
    applyFields: (fields) =>
      setForm((prev) =>
        mergeTranslatedFields(prev as unknown as Record<string, unknown>, fields) as FormState,
      ),
  });

  return (
    <StructureLockProvider locked={structureLocked}>
      <div>
        <PageHeader
          eyebrow="Hub"
          title={label}
          description={`Trang listing SEO — ${hubKey}`}
          actions={
            <HeadActions
              primary={
                <ViewPublicButton
                  href={publicPageUrl(
                    (query.data as { slug_full?: string } | undefined)?.slug_full,
                    locale,
                    defaultLocale,
                  )}
                />
              }
              secondary={
                <HeadSecondary
                  href="/"
                  icon={ArrowLeft}
                  title="Quay lại"
                  subtitle="Bảng điều khiển"
                />
              }
            />
          }
        />
        <LocaleSwitcher
          languages={languages}
          value={locale}
          onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty })}
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
                rating_aggregate_star: form.rating_aggregate_star,
                rating_aggregate_count: form.rating_aggregate_count,
              }}
              onChange={(key, v) => setForm((prev) => ({ ...prev, [key]: v }))}
              showParent={false}
              locale={locale}
              defaultLocale={defaultLocale}
              description="Hub cấp 1 — slug gốc, meta và schema rating."
            />

            <FormSection
              icon={LayoutTemplate}
              title="Nội dung listing"
              description="Tiêu đề, mô tả ngắn dưới H1 và đoạn SEO cuối listing (rỗng = ẩn)."
            >
              <FormCluster cols={1}>
                <Input label="Tiêu đề" name="title" value={form.title} onChange={(e) => set('title', e.target.value)} />
                <ListingChromeCopyFields
                  subtitle={form.body}
                  seoBody={form.seo_body}
                  subtitleName="body"
                  seoBodyName="seo_body"
                  editorEpoch={listingEditorEpoch}
                  onSubtitleChange={(v) => set('body', v)}
                  onSeoBodyChange={(v) => set('seo_body', v)}
                />
              </FormCluster>
            </FormSection>

            <FormFooter
              loading={save.isPending}
              viewHref={publicPageUrl(
                (query.data as { slug_full?: string } | undefined)?.slug_full,
                locale,
                defaultLocale,
              )}
              preActions={
                <AiEnrichListingButton
                  entityType="listing_hub"
                  locale={locale}
                  hubKey={hubKey}
                  getForm={() => form as unknown as Record<string, unknown>}
                  applyFields={(fields) => {
                    setForm((prev) =>
                      mergeListingEnrichFields(
                        prev as unknown as Record<string, unknown>,
                        fields,
                        'listing_hub',
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
                ariaLabel="Ảnh đại diện hub"
                folder="countries"
                slug={form.seo_slug}
                role="cover"
                aspectRatio="3 / 2"
                variant="card"
                value={form.cover}
                onChange={(cover) => set('cover', cover)}
              />
            </FormThumbCard>
            <FormBannerCard description="Hero first-view trang hub">
              <ImageField
                ariaLabel="Banner hub"
                folder="countries"
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
