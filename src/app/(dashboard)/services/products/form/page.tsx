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
import { AiEnrichStayButton } from '@/components/services/AiEnrichStayButton';
import {
  StayProductFields,
  stayAttrsFromApi,
  stayAttrsToApi,
} from '@/components/services/StayProductFields';
import { PriceTableEditor } from '@/components/ui/PriceTableEditor';
import { emptyPriceTable, hydratePriceTable, serializePriceTable, type PriceTableForm } from '@/lib/priceTable';
import {
  mergeEnrichFields,
  mergeStayEnrichFields,
  type StayRoomFormRow,
} from '@/lib/aiEnrichFields';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { serviceClusterTitle } from '@/lib/nav';

type GalleryRow = GalleryFieldRow;

type FormState = {
  cluster: string;
  service_category_id: string;
  service_category_ids: string[];
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
  featured_quote_text: string;
  featured_quote_author: string;
  star_rating: string;
  discount_badge: string;
  stay_attrs: ReturnType<typeof stayAttrsFromApi>;
  options: StayRoomFormRow[];
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
  service_category_ids: [],
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
  featured_quote_text: '',
  featured_quote_author: '',
  star_rating: '',
  discount_badge: '',
  stay_attrs: stayAttrsFromApi({}),
  options: [],
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

  const isStay = form.cluster === 'stay';

  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data as Record<string, any>;
    const next: FormState = {
      cluster: d.cluster || clusterFromUrl,
      service_category_id: d.service_category_id ? String(d.service_category_id) : '',
      service_category_ids: Array.isArray(d.service_category_ids)
        ? d.service_category_ids.map(String)
        : (d.service_category_id ? [String(d.service_category_id)] : []),
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
      featured_quote_text: d.featured_quote_text || '',
      featured_quote_author: d.featured_quote_author || '',
      star_rating: d.star_rating != null ? String(d.star_rating) : '',
      discount_badge: d.discount_badge || '',
      stay_attrs: stayAttrsFromApi(d.attrs),
      options: Array.isArray(d.options) ? d.options : [],
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
        service_category_id: form.service_category_id ? Number(form.service_category_id) : (form.service_category_ids[0] ? Number(form.service_category_ids[0]) : null),
        service_category_ids: form.service_category_ids.map(Number).filter(Boolean),
        country_id: form.country_id ? Number(form.country_id) : null,
        price_from: form.price_from ? Number(form.price_from) : null,
        sort: Number(form.sort) || 0,
        star_rating: form.star_rating ? Number(form.star_rating) : null,
        discount_badge: form.discount_badge || null,
        attrs: isStay ? stayAttrsToApi(form.stay_attrs) : undefined,
        options: isStay ? form.options : undefined,
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
        ...(isStay
          ? {
              summary: null,
              highlights: '',
            }
          : {
              price_table: {
                ...serializePriceTable(form.price_table),
                currency: form.currency || 'VND',
              },
            }),
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
            {/* Custom Multi-Select: Danh mục lưu trú / Dịch vụ (Số nhiều) */}
            <div className="ui-field col-span-2">
              <label className="ui-field__label">
                <span>Danh mục / Khu vực lưu trú (Chọn nhiều)</span>
              </label>
              <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                {/* Selected Chips */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                  {form.service_category_ids.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Chưa chọn danh mục nào</span>
                  ) : (
                    form.service_category_ids.map((cid) => {
                      const cat = (metaQuery.data?.categories ?? []).find((c) => String(c.id) === String(cid));
                      const isPrimary = String(form.service_category_id) === String(cid);
                      return (
                        <span
                          key={cid}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isPrimary
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{cat?.name || `#${cid}`}</span>
                          {isPrimary && (
                            <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">
                              ★ Chính
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={structureLocked}
                            onClick={() => {
                              const nextIds = form.service_category_ids.filter((id) => id !== cid);
                              let nextPrimary = form.service_category_id;
                              if (nextPrimary === cid) {
                                nextPrimary = nextIds[0] || '';
                              }
                              setForm((prev) => ({
                                ...prev,
                                service_category_ids: nextIds,
                                service_category_id: nextPrimary,
                              }));
                              const parent = (metaQuery.data?.seo_parents ?? []).find(
                                (p) => String(p.reference_id ?? '') === String(nextPrimary),
                              );
                              if (parent) set('seo_parent_id', String(parent.id));
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Categories Checkboxes List Container */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                  <div className="max-h-48 overflow-y-auto p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {(metaQuery.data?.categories ?? []).map((c) => {
                      const cid = String(c.id);
                      const isChecked = form.service_category_ids.includes(cid);
                      const isPrimary = String(form.service_category_id) === cid;

                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                            isChecked ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={structureLocked}
                              checked={isChecked}
                              onChange={(e) => {
                                let nextIds = [...form.service_category_ids];
                                if (e.target.checked) {
                                  if (!nextIds.includes(cid)) nextIds.push(cid);
                                } else {
                                  nextIds = nextIds.filter((id) => id !== cid);
                                }
                                let nextPrimary = form.service_category_id;
                                if (e.target.checked && (!nextPrimary || !nextIds.includes(nextPrimary))) {
                                  nextPrimary = cid;
                                } else if (!e.target.checked && nextPrimary === cid) {
                                  nextPrimary = nextIds[0] || '';
                                }
                                setForm((prev) => ({
                                  ...prev,
                                  service_category_ids: nextIds,
                                  service_category_id: nextPrimary,
                                }));
                                const parent = (metaQuery.data?.seo_parents ?? []).find(
                                  (p) => String(p.reference_id ?? '') === String(nextPrimary),
                                );
                                if (parent) set('seo_parent_id', String(parent.id));
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{c.name || `#${c.id}`}</span>
                            
                          </label>

                          {isChecked && (
                            <button
                              type="button"
                              disabled={structureLocked}
                              onClick={() => {
                                set('service_category_id', cid);
                                const parent = (metaQuery.data?.seo_parents ?? []).find(
                                  (p) => String(p.reference_id ?? '') === String(cid),
                                );
                                if (parent) set('seo_parent_id', String(parent.id));
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                isPrimary
                                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-700'
                              }`}
                              title={isPrimary ? 'Danh mục chính đại diện SEO & URL' : 'Đặt làm danh mục chính'}
                            >
                              {isPrimary ? '★ Chính' : 'Đặt chính'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
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
            <Input
              label={isStay ? 'Vị trí / địa chỉ' : 'Vị trí'}
              name="location_label"
              value={form.location_label}
              onChange={(e) => set('location_label', e.target.value)}
            />
            {!isStay ? (
              <Textarea
                label="Tóm tắt"
                name="summary"
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
              />
            ) : null}
          </FormSection>

          {isStay ? (
            <StayProductFields
              attrs={form.stay_attrs}
              options={form.options}
              starRating={form.star_rating}
              discountBadge={form.discount_badge}
              propertyTypes={metaQuery.data?.property_types ?? []}
              content={form.content}
              contentEditorKey={`service-content-${id ?? 'new'}-${contentEditorEpoch}`}
              isFeatured={form.is_featured}
              isHotDeal={form.is_hot_deal}
              serviceId={id}
              locale={locale}
              dealLabels={metaQuery.data?.deal_labels ?? []}
              onChangeAttrs={(stay_attrs) => setForm((p) => ({ ...p, stay_attrs }))}
              onChangeOptions={(options) => setForm((p) => ({ ...p, options }))}
              onChangeStarRating={(star_rating) => setForm((p) => ({ ...p, star_rating }))}
              onChangeDiscountBadge={(discount_badge) => setForm((p) => ({ ...p, discount_badge }))}
              onChangeContent={(content) => set('content', content)}
              onChangeFeatured={(is_featured) => set('is_featured', is_featured)}
              onChangeHotDeal={(is_hot_deal) => set('is_hot_deal', is_hot_deal)}
            />
          ) : null}

          {!isStay ? (
            <FormSection title="Nội dung chi tiết">
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
          ) : null}

          {!isStay ? (
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
          ) : null}

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
              { preview: form.status !== 'published' },
            )}
            preActions={
              isStay ? (
                <AiEnrichStayButton
                  locale={locale}
                  getForm={() => form as unknown as Record<string, unknown>}
                  applyFields={(fields) => {
                    setForm((prev) =>
                      mergeStayEnrichFields(prev as unknown as Record<string, unknown>, fields) as FormState,
                    );
                    setContentEditorEpoch((n) => n + 1);
                  }}
                />
              ) : (
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
              )
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
              maxItems={isStay ? 120 : 40}
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
