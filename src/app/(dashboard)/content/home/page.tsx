'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { homeSectionsApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { useRegisterAiTranslate } from '@/hooks/useAiFormTranslate';
import { pickTranslatableFields, mergeTranslatedFields } from '@/lib/aiTranslateFields';
import { StructureNotice } from '@/components/ui/StructureNotice';
import { DEFAULT_LOCALE, isDefaultLocale } from '@/lib/locale';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormSection } from '@/components/ui/FormSection';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';
import { publicPageUrl } from '@/lib/publicUrl';
import type { LocaleOption } from '@/lib/locale';

type Section = {
  id: number;
  key: string;
  label?: string | null;
  is_active: boolean;
  fields?: string[];
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  eyebrow?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  meta_line?: string | null;
};

const FIELD_META: Record<string, { label: string; multiline?: boolean }> = {
  eyebrow: { label: 'Nhãn nhỏ' },
  title: { label: 'Tiêu đề' },
  subtitle: { label: 'Phụ đề', multiline: true },
  body: { label: 'Nội dung', multiline: true },
  meta_line: { label: 'Dòng meta' },
  cta_label: { label: 'Nhãn nút CTA' },
  cta_url: { label: 'URL nút CTA' },
};

export default function HomeContentPage() {
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [sections, setSections] = useState<Section[]>([]);
  const [usps, setUsps] = useState<
    { id?: number; icon: string; title?: string | null; description?: string | null }[]
  >([]);
  const snapshotRef = useRef('');
  const isDirty = useMemo(
    () => JSON.stringify({ sections, usps }) !== snapshotRef.current,
    [sections, usps],
  );

  const query = useQuery({
    queryKey: ['home-sections', locale],
    queryFn: () => homeSectionsApi.get(locale),
  });

  useEffect(() => {
    if (!query.data) return;
    const d = query.data as {
      sections?: Section[];
      usps?: { id?: number; icon: string; title?: string | null; description?: string | null }[];
    };
    setSections((d.sections as Section[]) || []);
    setUsps(d.usps || []);
    snapshotRef.current = JSON.stringify({ sections: d.sections || [], usps: d.usps || [] });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      homeSectionsApi.update({
        locale,
        sections,
        usps,
        pills: (query.data as { pills?: unknown[] })?.pills || [],
        featured_tours: (query.data as { featured_tours?: unknown[] })?.featured_tours || [],
        featured_cruises: (query.data as { featured_cruises?: unknown[] })?.featured_cruises || [],
        featured_countries:
          (query.data as { featured_countries?: unknown[] })?.featured_countries || [],
        featured_platforms:
          (query.data as { featured_platforms?: unknown[] })?.featured_platforms || [],
      }),
    onSuccess: async () => {
      toast.success('Đã lưu nội dung trang chủ');
      await qc.invalidateQueries({ queryKey: ['home-sections'] });
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
    entityType: 'home_sections',
    sourceLocale: defaultLocale,
    targetLocale: locale,
    getFields: () =>
      pickTranslatableFields({
        sections: sections as unknown as Record<string, unknown>[],
        usps: usps as unknown as Record<string, unknown>[],
      } as Record<string, unknown>),
    getSourceFields: async () => {
      const d = (await homeSectionsApi.get(defaultLocale)) as {
        sections?: Section[];
        usps?: { id?: number; icon: string; title?: string | null; description?: string | null }[];
      };
      return pickTranslatableFields({
        sections: (d.sections || []) as unknown as Record<string, unknown>[],
        usps: (d.usps || []) as unknown as Record<string, unknown>[],
      } as Record<string, unknown>);
    },
    applyFields: (fields) => {
      const merged = mergeTranslatedFields(
        { sections, usps } as unknown as Record<string, unknown>,
        fields,
      ) as { sections: Section[]; usps: typeof usps };
      if (merged.sections) setSections(merged.sections);
      if (merged.usps) setUsps(merged.usps);
    },
  });

  const setSectionField = (idx: number, field: string, value: string | boolean) => {
    setSections((prev) => prev.map((x, i) => (i === idx ? { ...x, [field]: value } : x)));
  };

  return (
    <StructureLockProvider locked={structureLocked}>
      <div>
        <PageHeader
          eyebrow="Nội dung"
          title="Nội dung trang chủ"
          description="Chỉnh section copy + USP — gồm khối «Lời nhắn cho chúng tôi» (quick_inquiry)."
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
            save.mutate();
          }}
          className="ui-form-stack"
        >
          {sections.map((s, idx) => {
            const fields =
              s.fields && s.fields.length > 0
                ? s.fields
                : ['eyebrow', 'title', 'subtitle', 'body'];
            return (
              <FormSection key={s.id} title={s.label || s.key}>
                <Switch
                  label="Đang hoạt động"
                  checked={!!s.is_active}
                  onChange={(v) => setSectionField(idx, 'is_active', v)}
                />
                {fields.map((field) => {
                  const meta = FIELD_META[field];
                  if (!meta) return null;
                  const raw = s[field as keyof Section];
                  const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
                  if (meta.multiline) {
                    return (
                      <Textarea
                        key={field}
                        label={meta.label}
                        value={value}
                        onChange={(e) => setSectionField(idx, field, e.target.value)}
                      />
                    );
                  }
                  return (
                    <Input
                      key={field}
                      label={meta.label}
                      value={value}
                      onChange={(e) => setSectionField(idx, field, e.target.value)}
                    />
                  );
                })}
              </FormSection>
            );
          })}
          <FormSection title="Điểm nổi bật">
            {usps.map((u, idx) => (
              <div key={u.id || idx} style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                <Input
                  label="Mã icon"
                  value={u.icon}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, icon: e.target.value } : x)),
                    )
                  }
                  disabled={structureLocked}
                />
                <Input
                  label="Tiêu đề"
                  value={u.title || ''}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <Textarea
                  label="Mô tả"
                  value={u.description || ''}
                  onChange={(e) =>
                    setUsps((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
              </div>
            ))}
          </FormSection>
          <FormFooter
            loading={save.isPending}
            viewHref={publicPageUrl('/', locale)}
          />
        </form>
      </div>
    </StructureLockProvider>
  );
}
