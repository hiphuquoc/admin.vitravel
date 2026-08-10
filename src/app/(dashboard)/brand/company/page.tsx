'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from '@/lib/toast';
import { companyProfileApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale, type LocaleOption } from '@/lib/locale';
import { Input, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';
import { publicPageUrl } from '@/lib/publicUrl';

/** Trang Về chúng tôi — nội dung CMS. Liên hệ/brand → /settings/site. */
export default function CompanyPage() {
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<Record<string, string>>({});
  const snapshotRef = useRef('');
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const query = useQuery({
    queryKey: ['company-profile', locale],
    queryFn: () => companyProfileApi.get(locale),
  });

  useEffect(() => {
    if (!query.data) return;
    const d = query.data as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const key of [
      'about_page_title',
      'about_page_subtitle',
      'about_seo_title',
      'about_seo_description',
      'mission_title',
      'mission_text',
      'vision_title',
      'vision_text',
      'sales_policy_title',
      'sales_policy_content',
      'values_section_title',
      'reasons_section_title',
      'reference_section_title',
    ]) {
      next[key] = String(d[key] ?? '');
    }
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => companyProfileApi.update({ ...form, locale }),
    onSuccess: async () => {
      toast.success('Đã lưu trang công ty');
      await qc.invalidateQueries({ queryKey: ['company-profile'] });
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
    entityType: 'company_profile',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () => pickTranslatableFields(form),
    getSourceFields: async () => {
      const d = (await companyProfileApi.get(defaultLocale)) as Record<string, unknown>;
      const next: Record<string, string> = {};
      for (const key of Object.keys(form)) {
        next[key] = String(d[key] ?? '');
      }
      return pickTranslatableFields(next);
    },
    applyFields: (fields) =>
      setForm((prev) => mergeTranslatedFields(prev, fields) as Record<string, string>),
  });

  return (
    <StructureLockProvider locked={structureLocked} locale={locale} defaultLocale={defaultLocale}>
      <div>
        <PageHeader
          eyebrow="Thương hiệu"
          title="Công ty"
          description="Nội dung trang Về chúng tôi. Liên hệ / thương hiệu: Cài đặt → Thông tin dự án."
        />
        <p className="ui-page-hint" style={{ margin: '-0.5rem 0 1rem' }}>
          <Link href="/settings/site/">Mở Thông tin dự án →</Link>
        </p>
        <LocaleSwitcher
          languages={languages}
          value={locale}
          onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty })}
          translatedLocales={
            (query.data as { translated_locales?: string[] } | undefined)?.translated_locales
          }
        />
        <StructureNotice />
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="ui-form-stack"
        >
          <FormSection title="Giới thiệu">
            <Input
              label="Tiêu đề trang"
              value={form.about_page_title || ''}
              onChange={(e) => setForm((p) => ({ ...p, about_page_title: e.target.value }))}
            />
            <Textarea
              label="Phụ đề"
              value={form.about_page_subtitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, about_page_subtitle: e.target.value }))}
            />
            <Input
              label="Tiêu đề SEO"
              value={form.about_seo_title || ''}
              onChange={(e) => setForm((p) => ({ ...p, about_seo_title: e.target.value }))}
            />
            <Textarea
              label="Mô tả SEO"
              value={form.about_seo_description || ''}
              onChange={(e) => setForm((p) => ({ ...p, about_seo_description: e.target.value }))}
            />
          </FormSection>
          <FormSection title="Sứ mệnh / Tầm nhìn">
            <Input
              label="Tiêu đề sứ mệnh"
              value={form.mission_title || ''}
              onChange={(e) => setForm((p) => ({ ...p, mission_title: e.target.value }))}
            />
            <Textarea
              label="Nội dung sứ mệnh"
              value={form.mission_text || ''}
              onChange={(e) => setForm((p) => ({ ...p, mission_text: e.target.value }))}
            />
            <Input
              label="Tiêu đề tầm nhìn"
              value={form.vision_title || ''}
              onChange={(e) => setForm((p) => ({ ...p, vision_title: e.target.value }))}
            />
            <Textarea
              label="Nội dung tầm nhìn"
              value={form.vision_text || ''}
              onChange={(e) => setForm((p) => ({ ...p, vision_text: e.target.value }))}
            />
          </FormSection>
          <FormSection title="Chính sách bán hàng">
            <Input
              label="Tiêu đề"
              value={form.sales_policy_title || ''}
              onChange={(e) => setForm((p) => ({ ...p, sales_policy_title: e.target.value }))}
            />
            <Textarea
              label="Nội dung"
              value={form.sales_policy_content || ''}
              onChange={(e) => setForm((p) => ({ ...p, sales_policy_content: e.target.value }))}
            />
          </FormSection>
          <FormFooter
            loading={save.isPending}
            viewHref={publicPageUrl('about', locale)}
          />
        </form>
      </div>
    </StructureLockProvider>
  );
}
