'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { languagesApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { SeoBox, type SeoParentOption } from '@/components/ui/SeoBox';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormHeadActions } from '@/components/ui/FormHeadActions';
import { publicPageUrl } from '@/lib/publicUrl';
import { replaceFormUrl } from '@/lib/formNavigate';
import { asLocaleOptions, DEFAULT_LOCALE, isDefaultLocale, type LocaleOption } from '@/lib/locale';
import { beginFormHydration, markFormHydrationStale } from '@/hooks/useFormHydration';
import { EDIT_FORM_QUERY_OPTIONS } from '@/lib/editFormQuery';

type Field =
  | {
      key: string;
      label: string;
      type?: 'text' | 'textarea' | 'number' | 'switch';
      /** number/switch mặc định là cấu trúc (khóa khi bản dịch). */
      structure?: boolean;
    }
  | {
      key: string;
      label: string;
      type: 'custom';
      structure?: boolean;
      render: (v: unknown, set: (v: unknown) => void, ctx: { structureLocked: boolean }) => ReactNode;
    };

type FormSetter = Dispatch<SetStateAction<Record<string, unknown>>>;

function isStructureField(field: Field): boolean {
  if (field.type === 'switch' || field.type === 'number') return field.structure !== false;
  if (field.type === 'custom') return field.structure === true;
  return field.structure === true;
}

/** Gom switch liên tiếp vào một hàng `ui-form-flags` (đồng bộ form đội ngũ / cảm nhận). */
function renderResourceFields(
  fields: Field[],
  form: Record<string, unknown>,
  setForm: FormSetter,
  structureLocked: boolean,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < fields.length) {
    const field = fields[i];

    if (field.type === 'switch') {
      const group: Extract<Field, { type?: string }>[] = [];
      while (i < fields.length && fields[i].type === 'switch') {
        group.push(fields[i]);
        i += 1;
      }
      nodes.push(
        <div key={`flags-${group.map((f) => f.key).join('-')}`} className="ui-form-flags">
          {group.map((f) => (
            <Switch
              key={f.key}
              label={f.label}
              checked={!!form[f.key]}
              structure={f.structure !== false}
              onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>,
      );
      continue;
    }

    if (field.type === 'custom') {
      nodes.push(
        <div key={field.key}>
          {field.render(
            form[field.key],
            (v) => setForm((prev) => ({ ...prev, [field.key]: v })),
            { structureLocked: structureLocked && isStructureField(field) },
          )}
        </div>,
      );
      i += 1;
      continue;
    }

    if (field.type === 'textarea') {
      nodes.push(
        <Textarea
          key={field.key}
          name={field.key}
          label={field.label}
          value={String(form[field.key] ?? '')}
          disabled={structureLocked && isStructureField(field)}
          onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />,
      );
      i += 1;
      continue;
    }

    nodes.push(
      <Input
        key={field.key}
        name={field.key}
        label={field.label}
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(form[field.key] ?? '')}
        disabled={structureLocked && isStructureField(field)}
        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
      />,
    );
    i += 1;
  }

  return nodes;
}

type Props = {
  eyebrow: string;
  listHref: string;
  queryKey: string;
  titleNew: string;
  titleEdit: string;
  fields: Field[];
  empty: Record<string, unknown>;
  getFn: (id: number, locale: string) => Promise<Record<string, unknown>>;
  createFn: (body: Record<string, unknown>) => Promise<{ id: number }>;
  updateFn: (id: number, body: Record<string, unknown>) => Promise<{ id: number }>;
  languagesFrom?: (data: Record<string, unknown> | undefined) => LocaleOption[];
  mapDetail?: (d: Record<string, unknown>) => Record<string, unknown>;
  mapPayload?: (form: Record<string, unknown>, locale: string) => Record<string, unknown>;
  withLocale?: boolean;
  /** Hiện SeoBox dùng chung phía trên Thông tin. */
  seoParents?: SeoParentOption[] | ((form: Record<string, unknown>) => SeoParentOption[]);
  /** Schema rating — mặc định bật. */
  seoShowRating?: boolean;
};

function Inner(props: Props) {
  const search = useSearchParams();
  const idParam = search.get('id');
  const id = idParam ? Number(idParam) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<Record<string, unknown>>(props.empty);
  const snapshotRef = useRef(JSON.stringify(props.empty));
  const hydrateKeyRef = useRef<string | null>(null);
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const detailQuery = useQuery({
    queryKey: [props.queryKey, id, locale],
    queryFn: () => props.getFn(id!, locale),
    enabled: !!id,
    ...EDIT_FORM_QUERY_OPTIONS,
  });

  const languagesQuery = useQuery({
    queryKey: ['languages-options'],
    queryFn: async () => {
      const res = await languagesApi.list();
      return (res.items || []).map((l) => ({
        code: String(l.code || ''),
        name: String(l.name || l.code || ''),
        name_native: String(l.name_native || ''),
        is_default: !!l.is_default,
      })) as LocaleOption[];
    },
    enabled: props.withLocale !== false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!detailQuery.data || !id) return;
    if (!beginFormHydration(hydrateKeyRef, id, locale)) return;
    const mapped = props.mapDetail ? props.mapDetail(detailQuery.data) : detailQuery.data;
    const next = { ...props.empty, ...mapped };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data, id, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const languages =
    asLocaleOptions(props.languagesFrom?.(detailQuery.data)) ??
    asLocaleOptions(detailQuery.data?.languages) ??
    languagesQuery.data ??
    [];

  const defaultLocale =
    languages.find((l) => l.is_default)?.code ||
    String(detailQuery.data?.default_locale || DEFAULT_LOCALE);

  const save = useMutation({
    mutationFn: async () => {
      if (isNew && !isDefaultLocale(locale, defaultLocale)) {
        throw new Error('Tạo mới chỉ ở ngôn ngữ mặc định. Lưu xong rồi dịch các ngôn ngữ khác.');
      }
      const payload = props.mapPayload ? props.mapPayload(form, locale) : { ...form, locale };
      return isNew ? props.createFn(payload) : props.updateFn(id!, payload);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo' : 'Đã lưu');
      snapshotRef.current = JSON.stringify(form);
      markFormHydrationStale(hydrateKeyRef);
      await qc.invalidateQueries({ queryKey: [props.queryKey] });
      replaceFormUrl(
        router,
        `${props.listHref.replace(/\/$/, '')}/form/?id=${data.id}&locale=${locale}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const structureLocked =
    props.withLocale === false ? false : !isDefaultLocale(locale, defaultLocale);

  useRegisterAiTranslate({
    enabled: structureLocked,
    entityType: props.queryKey,
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form),
    getSourceFields: async () => {
      if (!id) return pickTranslatableFields(form);
      const d = await props.getFn(id, defaultLocale);
      const mapped = props.mapDetail ? props.mapDetail(d) : d;
      return pickTranslatableFields({ ...props.empty, ...mapped });
    },
    applyFields: (fields) =>
      setForm((prev) => mergeTranslatedFields(prev, fields)),
  });

  const resolvedSeoParents =
    typeof props.seoParents === 'function'
      ? props.seoParents(form)
      : props.seoParents ?? [];

  return (
    <StructureLockProvider
      locked={structureLocked}
      locale={locale}
      defaultLocale={defaultLocale}
      seoParentId={String(form.seo_parent_id ?? '')}
      seoParents={resolvedSeoParents}
    >
      <div>
        <PageHeader
          eyebrow={props.eyebrow}
          title={isNew ? props.titleNew : props.titleEdit}
          id={isNew ? null : id}
          actions={
            <FormHeadActions
              backHref={props.listHref}
              viewHref={publicPageUrl(
                (detailQuery.data?.seo as { slug_full?: string } | undefined)?.slug_full,
                locale,
                defaultLocale,
              )}
            />
          }
        />

        {props.withLocale !== false ? (
          <LocaleSwitcher
            languages={languages}
            value={locale}
            onChange={(code) => {
              if (isNew && !isDefaultLocale(code, defaultLocale)) {
                toast.error('Tạo mới chỉ ở ngôn ngữ mặc định. Lưu xong rồi dịch.');
                return;
              }
              setLocale(code, { confirmIfDirty: true, isDirty });
            }}
            translatedLocales={
              (detailQuery.data?.translated_locales as string[]) ?? (isNew ? [] : undefined)
            }
          />
        ) : null}

        <StructureNotice />

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="ui-form-layout"
        >
          <div className="ui-form-layout__main ui-form-stack">
            {props.seoParents ? (
              <SeoBox
                value={{
                  seo_title: String(form.seo_title ?? ''),
                  seo_slug: String(form.seo_slug ?? ''),
                  seo_description: String(form.seo_description ?? ''),
                  seo_parent_id: String(form.seo_parent_id ?? ''),
                  rating_aggregate_star: String(form.rating_aggregate_star ?? ''),
                  rating_aggregate_count: String(form.rating_aggregate_count ?? ''),
                }}
                onChange={(key, v) => setForm((prev) => ({ ...prev, [key]: v }))}
                parents={resolvedSeoParents}
                showRating={props.seoShowRating ?? true}
                locale={locale}
                defaultLocale={defaultLocale}
              />
            ) : null}
            <FormSection title="Thông tin">
              {renderResourceFields(props.fields, form, setForm, structureLocked)}
            </FormSection>

            <FormFooter
              cancelHref={props.listHref}
              loading={save.isPending}
              viewHref={publicPageUrl(
                (detailQuery.data?.seo as { slug_full?: string } | undefined)?.slug_full,
                locale,
                defaultLocale,
              )}
            />
          </div>
        </form>
      </div>
    </StructureLockProvider>
  );
}

export function ResourceFormPage(props: Props) {
  return (
    <Suspense fallback={<EmptyForm />}>
      <Inner {...props} />
    </Suspense>
  );
}

function EmptyForm() {
  return <div style={{ padding: '2rem' }}>Đang tải form…</div>;
}
