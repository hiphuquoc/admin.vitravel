'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wallet } from 'lucide-react';
import toast from '@/lib/toast';
import { servicesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { ArticleContentEditor } from '@/components/editor/ArticleContentEditor';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { SeoBox } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { emptyImageField, ImageField, type ImageFieldState } from '@/components/ui/ImageField';
import { FormMediaAside, FormThumbCard, FormGalleryCard } from '@/components/ui/FormMediaAside';
import { GalleryField, emptyGalleryRow, type GalleryFieldRow } from '@/components/ui/GalleryField';
import { FormFooter } from '@/components/ui/FormFooter';
import { HeadActions, HeadSecondary } from '@/components/ui/HeadActions';
import { AiEnrichProgramButton } from '@/components/ui/AiEnrichProgramButton';
import { PriceTableEditor } from '@/components/ui/PriceTableEditor';
import { emptyPriceTable, hydratePriceTable, serializePriceTable, type PriceTableForm } from '@/lib/priceTable';
import {
  mergeEnrichFields,
} from '@/lib/aiEnrichFields';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { serviceClusterTitle } from '@/lib/nav';

type GalleryRow = GalleryFieldRow;

type FormState = {
  cluster: string;
  service_category_id: string;
  country_id: string;
  code: string;
  title: string;
  status: string;
  price_from: string;
  currency: string;
  sort: string;
  is_featured: boolean;
  is_hot_deal: boolean;
  location_label: string;
  summary: string;
  content: string;
  highlights: string;
  inclusions: string;
  exclusions: string;
  notes: string;
  seo_slug: string;
  seo_title: string;
  seo_description: string;
  seo_parent_id: string;
  rating_aggregate_star: string;
  rating_aggregate_count: string;
  cover: ImageFieldState;
  gallery: GalleryRow[];
  price_table: PriceTableForm;
};

const empty: FormState = {
  cluster: 'experience',
  service_category_id: '',
  country_id: '',
  code: '',
  title: '',
  status: 'draft',
  price_from: '',
  currency: 'VND',
  sort: '0',
  is_featured: false,
  is_hot_deal: false,
  location_label: '',
  summary: '',
  content: '',
  highlights: '',
  inclusions: '',
  exclusions: '',
  notes: '',
  seo_slug: '',
  seo_title: '',
  seo_description: '',
  seo_parent_id: '',
  rating_aggregate_star: '',
  rating_aggregate_count: '',
  cover: emptyImageField(),
  gallery: [],
  price_table: emptyPriceTable(),
};

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
  /** Remount TipTap sau AI enrich — tránh giữ HTML cũ. */
  const [contentEditorEpoch, setContentEditorEpoch] = useState(0);
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const metaQuery = useQuery({
    queryKey: ['services-meta', locale, form.cluster],
    queryFn: () => servicesApi.meta(locale, form.cluster),
  });
  const detailQuery = useQuery({
    queryKey: ['service', id, locale],
    queryFn: () => servicesApi.get(id!, locale),
    enabled: !!id,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data;
    const next: FormState = {
      cluster: d.cluster || clusterFromUrl,
      service_category_id: d.service_category_id ? String(d.service_category_id) : '',
      country_id: d.country_id ? String(d.country_id) : '',
      code: d.code || '',
      title: d.title || '',
      status: d.status || 'draft',
      price_from: d.price_from != null ? String(d.price_from) : '',
      currency: d.currency || 'VND',
      sort: String(d.sort || 0),
      is_featured: !!d.is_featured,
      is_hot_deal: !!d.is_hot_deal,
      location_label: d.location_label || '',
      summary: d.summary || '',
      content: d.content || '',
      highlights: d.highlights || '',
      inclusions: d.inclusions || '',
      exclusions: d.exclusions || '',
      notes: d.notes || '',
      seo_slug: d.seo?.slug || '',
      seo_title: d.seo?.title || '',
      seo_description: d.seo?.description || '',
      seo_parent_id: d.seo?.parent_id ? String(d.seo.parent_id) : '',
      rating_aggregate_star:
        d.seo?.rating_aggregate_star != null ? String(d.seo.rating_aggregate_star) : '',
      rating_aggregate_count:
        d.seo?.rating_aggregate_count != null ? String(d.seo.rating_aggregate_count) : '',
      cover: emptyImageField(d.cover),
      gallery: Array.isArray(d.gallery)
        ? d.gallery.map((row) => emptyGalleryRow(row.media ?? null))
        : [],
      price_table: hydratePriceTable(d.price_table, d.currency || 'VND'),
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data, locale, clusterFromUrl]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        service_category_id: form.service_category_id ? Number(form.service_category_id) : null,
        country_id: form.country_id ? Number(form.country_id) : null,
        price_from: form.price_from ? Number(form.price_from) : null,
        sort: Number(form.sort) || 0,
        seo_parent_id: form.seo_parent_id ? Number(form.seo_parent_id) : null,
        rating_aggregate_star: form.rating_aggregate_star
          ? Number(form.rating_aggregate_star)
          : null,
        rating_aggregate_count: form.rating_aggregate_count
          ? Number(form.rating_aggregate_count)
          : null,
        cover_media_id: form.cover.media?.id ?? null,
        remove_cover: form.cover.remove,
        gallery_media_ids: form.gallery
          .map((row) => row.image.media?.id)
          .filter((id): id is number => typeof id === 'number' && id > 0),
        price_table: {
          ...serializePriceTable(form.price_table),
          currency: form.currency || 'VND',
        },
        locale,
      };
      return isNew ? servicesApi.create(payload) : servicesApi.update(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo' : 'Đã lưu');
      await qc.invalidateQueries({ queryKey: [`services-${form.cluster}`] });
      await qc.invalidateQueries({ queryKey: ['service', data.id] });
      replaceFormUrl(
        router,
        `/services/products/form/?id=${data.id}&locale=${locale}&cluster=${form.cluster}`,
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
    entityType: 'service',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form as unknown as Record<string, unknown>),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form as unknown as Record<string, unknown>);
      const d = (await servicesApi.get(id, defaultLocale)) as Record<string, any>;
      return pickTranslatableFields({
        title: d.title || '',
        summary: d.summary || '',
        body: d.body || '',
        seo_slug: d.seo?.slug || '',
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
        title={isNew ? `Thêm chi tiết ${kind}` : `Sửa chi tiết ${kind}`}
        id={isNew ? null : id}
        actions={
          <HeadActions
            secondary={
              <HeadSecondary
                href={
                  form.cluster
                    ? `/services/products/?cluster=${form.cluster}`
                    : '/services/products/'
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
        onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty })}
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
            description="Chọn danh mục / hub làm trang cha → URL phân tầng."
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
            <Select
              label="Danh mục"
              value={form.service_category_id}
              onChange={(v) => {
                set('service_category_id', v);
                const parent = (metaQuery.data?.seo_parents ?? []).find(
                  (p) => String(p.reference_id ?? '') === String(v),
                );
                if (parent) set('seo_parent_id', String(parent.id));
              }}
              placeholder="Chọn"
              options={(metaQuery.data?.categories ?? []).map((c) => ({
                value: String(c.id),
                label: c.name || `#${c.id}`,
              }))}
            disabled={structureLocked}
            />
            <Select
              label="Quốc gia"
              value={form.country_id}
              onChange={(v) => set('country_id', v)}
              placeholder="—"
              options={(metaQuery.data?.countries ?? []).map((c) => ({
                value: String(c.id),
                label: c.name || `#${c.id}`,
              }))}
            disabled={structureLocked}
            />
            <Input label="Mã" value={form.code} onChange={(e) => set('code', e.target.value)} />
            <Input
              label="Tiêu đề"
              name="title"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value);
                if (isNew && !form.seo_title) set('seo_title', e.target.value);
              }}
            />
            <Select
              label="Trạng thái"
              value={form.status}
              onChange={(v) => set('status', v)}
              options={(metaQuery.data?.statuses ?? []).map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            disabled={structureLocked}
            />
            <Input
              label="Giá từ"
              value={form.price_from}
              onChange={(e) => set('price_from', e.target.value)}
            disabled={structureLocked}
            />
            <Input
              label="Đơn vị tiền"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            />
            <Textarea
              label="Tóm tắt"
              name="summary"
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
            />
            <ArticleContentEditor
              key={`service-content-${id ?? 'new'}-${contentEditorEpoch}`}
              label="Nội dung chi tiết"
              hint="HTML lịch trình / mô tả dịch vụ — AI chương trình ghi vào đây. Public render an toàn."
              format="html"
              compact
              aiFieldKey="content"
              value={form.content}
              onChange={(next) => set('content', next)}
            />
            <Textarea
              label="Điểm nổi bật (mỗi dòng)"
              name="highlights"
              value={form.highlights}
              onChange={(e) => set('highlights', e.target.value)}
            />
            <Textarea
              label="Bao gồm"
              name="inclusions"
              value={form.inclusions}
              onChange={(e) => set('inclusions', e.target.value)}
            />
            <Textarea
              label="Không bao gồm"
              name="exclusions"
              value={form.exclusions}
              onChange={(e) => set('exclusions', e.target.value)}
            />
            <Textarea
              label="Lưu ý"
              name="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
            <div className="ui-form-flags">
              <Switch
                label="Nổi bật"
                checked={form.is_featured}
                onChange={(v) => set('is_featured', v)}
              />
              <Switch
                label="Ưu đãi hot"
                checked={form.is_hot_deal}
                onChange={(v) => set('is_hot_deal', v)}
              />
            </div>
          </FormSection>

          <FormSection
            icon={Wallet}
            title="Bảng giá chi tiết"
            description="Theo ngày / khoảng / năm × tuỳ chọn × đối tượng khách × khuyến mãi. Giá “từ” dùng cho listing."
          >
            <PriceTableEditor
              value={form.price_table}
              onChange={(price_table) => set('price_table', price_table)}
              locale={locale}
            />
          </FormSection>

          <FormFooter
            cancelHref={
              form.cluster
                ? `/services/products/?cluster=${form.cluster}`
                : '/services/products/'
            }
            loading={save.isPending}
            viewHref={publicPageUrl(
              detailQuery.data?.seo?.slug_full,
              locale,
              metaQuery.data?.default_locale || 'vi',
            )}
            preActions={
              <AiEnrichProgramButton
                entityType="service"
                locale={locale}
                kind="service"
                getForm={() => form as unknown as Record<string, unknown>}
                applyFields={(fields) => {
                  setForm((prev) =>
                    mergeEnrichFields(prev as unknown as Record<string, unknown>, fields) as FormState,
                  );
                  setContentEditorEpoch((n) => n + 1);
                }}
              />
            }
          />
        </div>

        <FormMediaAside>
          <FormThumbCard>
            <ImageField
              ariaLabel="Ảnh đại diện dịch vụ"
              folder="services"
              slug={form.seo_slug}
              role="cover"
              aspectRatio="3 / 2"
              variant="card"
              value={form.cover}
              onChange={(v) => set('cover', v)}
            />
          </FormThumbCard>
          <FormGalleryCard>
            <GalleryField
              folder="services"
              slug={form.seo_slug}
              role="gallery"
              value={form.gallery}
              onChange={(gallery) => set('gallery', gallery)}
            />
          </FormGalleryCard>
        </FormMediaAside>
      </form>
    </div>
    </StructureLockProvider>
  );
}

export default function ServiceProductFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Đang tải…</div>}>
      <FormInner />
    </Suspense>
  );
}
