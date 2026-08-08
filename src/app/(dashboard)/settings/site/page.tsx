'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { companyProfileApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale, type LocaleOption } from '@/lib/locale';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';

const SITE_KEYS = [
  'name',
  'legal_name',
  'tagline',
  'slogan',
  'license_number',
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'contact_zalo',
  'hotline_label',
  'address_street',
  'address_locality',
  'address_region',
  'address_postal',
  'address_country',
  'social_facebook_url',
  'social_facebook_label',
  'social_youtube_url',
  'social_youtube_label',
  'social_instagram_url',
  'social_instagram_label',
  'social_tiktok_url',
  'social_tiktok_label',
  'footer_copyright',
  'schema_logo',
  'schema_contact_type',
  'schema_available_language',
] as const;

type FormState = Record<(typeof SITE_KEYS)[number], string> & {
  show_dmca_badge: boolean;
};

const empty: FormState = {
  name: '',
  legal_name: '',
  tagline: '',
  slogan: '',
  license_number: '',
  contact_email: '',
  contact_phone: '',
  contact_whatsapp: '',
  contact_zalo: '',
  hotline_label: 'Hotline',
  address_street: '',
  address_locality: '',
  address_region: '',
  address_postal: '',
  address_country: '',
  social_facebook_url: '',
  social_facebook_label: 'Facebook',
  social_youtube_url: '',
  social_youtube_label: 'YouTube',
  social_instagram_url: '',
  social_instagram_label: 'Instagram',
  social_tiktok_url: '',
  social_tiktok_label: 'TikTok',
  footer_copyright: '',
  schema_logo: '',
  schema_contact_type: 'customer service',
  schema_available_language: 'Vietnamese, English',
  show_dmca_badge: true,
};

/** Cài đặt thông tin dự án / liên hệ / social / footer (thay config/company.php). */
export default function SiteSettingsPage() {
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [form, setForm] = useState<FormState>(empty);
  const snapshotRef = useRef(JSON.stringify(empty));
  const isDirty = useMemo(() => JSON.stringify(form) !== snapshotRef.current, [form]);

  const query = useQuery({
    queryKey: ['company-profile-site', locale],
    queryFn: () => companyProfileApi.get(locale),
  });

  useEffect(() => {
    if (!query.data) return;
    const d = query.data as Record<string, unknown>;
    const next: FormState = { ...empty };
    for (const key of SITE_KEYS) {
      next[key] = String(d[key] ?? empty[key] ?? '');
    }
    next.show_dmca_badge = d.show_dmca_badge !== false && d.show_dmca_badge !== 0;
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      companyProfileApi.update({
        ...form,
        show_dmca_badge: form.show_dmca_badge,
        locale,
      }),
    onSuccess: async () => {
      toast.success('Đã lưu thông tin dự án');
      await qc.invalidateQueries({ queryKey: ['company-profile'] });
      await qc.invalidateQueries({ queryKey: ['company-profile-site'] });
      snapshotRef.current = JSON.stringify(form);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const languages =
    ((query.data as { languages?: LocaleOption[] } | undefined)?.languages) ?? [];
  const defaultLocale = String(
    (query.data as { default_locale?: string } | undefined)?.default_locale || DEFAULT_LOCALE,
  );
  const structureLocked = !isDefaultLocale(locale, defaultLocale);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <StructureLockProvider locked={structureLocked} locale={locale} defaultLocale={defaultLocale}>
      <div>
        <PageHeader
          eyebrow="Cài đặt"
          title="Thông tin dự án"
          description="Thương hiệu, liên hệ, địa chỉ, mạng xã hội và footer — nguồn runtime thay cho config/company.php."
        />
        <LocaleSwitcher
          languages={languages}
          value={locale}
          onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty })}
        />
        <StructureNotice />
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (structureLocked) {
              toast.error('Chỉnh thông tin dự án ở ngôn ngữ mặc định.');
              return;
            }
            save.mutate();
          }}
          className="ui-form-stack"
        >
          <FormSection
            title="Thương hiệu"
            description="Tên hiển thị, slogan và giấy phép lữ hành."
          >
            <FormCluster>
              <Input
                label="Tên thương hiệu"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Tên pháp lý"
                value={form.legal_name}
                onChange={(e) => set('legal_name', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Tagline"
                value={form.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Slogan (footer / schema)"
                value={form.slogan}
                onChange={(e) => set('slogan', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Số giấy phép lữ hành"
                value={form.license_number}
                onChange={(e) => set('license_number', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>
          </FormSection>

          <FormSection title="Liên hệ" description="Hotline, email, Zalo, WhatsApp trên header / footer / nút nổi.">
            <FormCluster>
              <Input
                label="Nhãn hotline"
                value={form.hotline_label}
                onChange={(e) => set('hotline_label', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Điện thoại / Hotline"
                value={form.contact_phone}
                onChange={(e) => set('contact_phone', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Email"
                value={form.contact_email}
                onChange={(e) => set('contact_email', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="WhatsApp"
                value={form.contact_whatsapp}
                onChange={(e) => set('contact_whatsapp', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Zalo"
                value={form.contact_zalo}
                onChange={(e) => set('contact_zalo', e.target.value)}
                disabled={structureLocked}
              />
            </FormCluster>
          </FormSection>

          <FormSection title="Địa chỉ trụ sở" description="PostalAddress / Organization schema.">
            <FormCluster>
              <Input
                label="Đường / số nhà"
                value={form.address_street}
                onChange={(e) => set('address_street', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Thành phố / quận"
                value={form.address_locality}
                onChange={(e) => set('address_locality', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Tỉnh / vùng"
                value={form.address_region}
                onChange={(e) => set('address_region', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Mã bưu chính"
                value={form.address_postal}
                onChange={(e) => set('address_postal', e.target.value)}
                disabled={structureLocked}
              />
              <Input
                label="Mã quốc gia"
                value={form.address_country}
                onChange={(e) => set('address_country', e.target.value)}
                disabled={structureLocked}
                hint="VD: VN"
              />
            </FormCluster>
          </FormSection>

          <FormSection title="Mạng xã hội" description="URL trống → ẩn khỏi footer và schema sameAs.">
            <FormCluster cols={1}>
              {(
                [
                  ['facebook', 'Facebook'],
                  ['youtube', 'YouTube'],
                  ['instagram', 'Instagram'],
                  ['tiktok', 'TikTok'],
                ] as const
              ).map(([key, label]) => (
                <FormCluster key={key} title={label}>
                  <Input
                    label="Nhãn"
                    value={form[`social_${key}_label`]}
                    onChange={(e) => set(`social_${key}_label`, e.target.value)}
                    disabled={structureLocked}
                  />
                  <Input
                    label="URL"
                    value={form[`social_${key}_url`]}
                    onChange={(e) => set(`social_${key}_url`, e.target.value)}
                    disabled={structureLocked}
                    placeholder="https://"
                  />
                </FormCluster>
              ))}
            </FormCluster>
          </FormSection>

          <FormSection title="Footer & schema">
            <Textarea
              label="Copyright footer"
              value={form.footer_copyright}
              onChange={(e) => set('footer_copyright', e.target.value)}
              disabled={structureLocked}
              hint="Placeholder: :year · :license · :name"
            />
            <Switch
              label="Hiện badge DMCA"
              checked={form.show_dmca_badge}
              onChange={(v) => set('show_dmca_badge', v)}
              disabled={structureLocked}
            />
            <Input
              label="Logo / OG mặc định (URL)"
              value={form.schema_logo}
              onChange={(e) => set('schema_logo', e.target.value)}
              disabled={structureLocked}
            />
            <Input
              label="Schema contact type"
              value={form.schema_contact_type}
              onChange={(e) => set('schema_contact_type', e.target.value)}
              disabled={structureLocked}
            />
            <Input
              label="Ngôn ngữ schema (phẩy)"
              value={form.schema_available_language}
              onChange={(e) => set('schema_available_language', e.target.value)}
              disabled={structureLocked}
              hint="VD: Vietnamese, English"
            />
          </FormSection>

          <FormFooter submitLabel="Lưu thông tin dự án" loading={save.isPending} showAiTranslate={false} />
        </form>
      </div>
    </StructureLockProvider>
  );
}
