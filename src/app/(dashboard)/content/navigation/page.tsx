'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { navigationMenuApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import { PageHeader } from '@/components/ui/Page';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormSection } from '@/components/ui/FormSection';
import { Input, Switch, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Repeater } from '@/components/ui/Repeater';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { asLocaleOptions, type LocaleOption } from '@/lib/locale';

type NavItem = {
  id?: number | null;
  zone: string;
  kind: string;
  kind_label?: string;
  item_key: string;
  reference?: string | null;
  sort: number;
  is_active: boolean;
  show_in_main_bar?: boolean;
  label?: string | null;
  lead_label?: string | null;
  meta?: string | null;
};

const ZONE_ORDER = ['main', 'more', 'cta'] as const;

const ZONE_LABELS: Record<string, string> = {
  main: 'Thanh menu chính',
  more: 'Menu ⋯ (thêm)',
  cta: 'Nút CTA header',
};

export default function NavigationMenuPage() {
  const qc = useQueryClient();
  const { locale, setLocale } = useEditLocale();
  const [items, setItems] = useState<NavItem[]>([]);
  const snapshot = useRef('');

  const { data, isLoading } = useQuery({
    queryKey: ['navigation-menu', locale],
    queryFn: () => navigationMenuApi.get(locale),
  });

  const languages = asLocaleOptions(data?.languages) ?? ([] as LocaleOption[]);

  useEffect(() => {
    if (!data) return;
    const rows = (data.items as NavItem[]) || [];
    setItems(rows);
    snapshot.current = JSON.stringify(rows);
  }, [data]);

  const dirty = useMemo(() => JSON.stringify(items) !== snapshot.current, [items]);

  const saveMutation = useMutation({
    mutationFn: () =>
      navigationMenuApi.update({
        locale,
        items: items.map((row, index) => ({
          ...row,
          sort: index + 1,
        })),
      }),
    onSuccess: async () => {
      toast.success('Đã lưu menu public.');
      await qc.invalidateQueries({ queryKey: ['navigation-menu'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => navigationMenuApi.reset(),
    onSuccess: async () => {
      toast.success('Đã khôi phục menu mặc định từ seed.');
      await qc.invalidateQueries({ queryKey: ['navigation-menu'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itemsByZone = (zone: string) =>
    items
      .filter((row) => row.zone === zone)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const updateZoneItems = (zone: string, zoneItems: NavItem[]) => {
    const others = items.filter((row) => row.zone !== zone);
    const merged = [...others, ...zoneItems.map((row, index) => ({ ...row, zone, sort: index + 1 }))];
    setItems(merged.sort((a, b) => ZONE_ORDER.indexOf(a.zone as (typeof ZONE_ORDER)[number]) - ZONE_ORDER.indexOf(b.zone as (typeof ZONE_ORDER)[number]) || (a.sort || 0) - (b.sort || 0)));
  };

  if (isLoading && !data) {
    return <p className="p-6 text-sm text-gray-500">Đang tải menu…</p>;
  }

  const isCustomized = Boolean(data?.is_customized);

  return (
    <StructureLockProvider locked={false}>
      <form
        className="adminFormPage_form"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="adminFormPage">
          <PageHeader
            eyebrow="Nội dung"
            title="Menu chính (public)"
            description="Tùy chỉnh nhãn, thứ tự và hiển thị menu header theo từng dự án và ngôn ngữ. Danh mục con (quốc gia, loại du thuyền, danh mục dịch vụ) vẫn lấy từ CMS."
          />
          <LocaleSwitcher
            languages={languages}
            value={locale}
            onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty: dirty })}
          />

          {!isCustomized ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Đang dùng menu mặc định từ seed dự án. Chỉnh sửa và lưu để ghi đè theo project hiện tại.
            </p>
          ) : null}

          {ZONE_ORDER.map((zone) => (
            <FormSection key={zone} title={ZONE_LABELS[zone] || zone}>
              <Repeater
                items={itemsByZone(zone)}
                onChange={(zoneItems) => updateZoneItems(zone, zoneItems)}
                lockStructure={false}
                addLabel="Thêm mục"
                createItem={() => ({
                  zone,
                  kind: 'route_link',
                  item_key: `custom_${Date.now()}`,
                  reference: 'about',
                  sort: itemsByZone(zone).length + 1,
                  is_active: true,
                  show_in_main_bar: true,
                  label: '',
                })}
                keyOf={(row) => row.item_key}
                renderItem={(row, _index, { update }) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="text-xs font-medium text-gray-500 md:col-span-2">
                      {row.kind_label || row.kind}
                      {row.reference ? ` · ${row.reference}` : ''}
                    </div>
                    <Input
                      label="Nhãn menu"
                      value={row.label || ''}
                      onChange={(e) => update({ label: e.target.value })}
                    />
                    {['tours_menu', 'cruise_menu', 'service_cluster'].includes(row.kind) ? (
                      <Input
                        label="Nhãn dòng dẫn (Tất cả …)"
                        value={row.lead_label || ''}
                        onChange={(e) => update({ lead_label: e.target.value })}
                      />
                    ) : null}
                    {['tours_menu', 'cruise_menu', 'service_cluster'].includes(row.kind) ? (
                      <Textarea
                        label="Mô tả phụ (flyout)"
                        rows={2}
                        value={row.meta || ''}
                        onChange={(e) => update({ meta: e.target.value })}
                        className="md:col-span-2"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                      <Switch
                        label="Hiển thị"
                        checked={row.is_active}
                        onChange={(checked) => update({ is_active: checked })}
                      />
                      {row.kind === 'service_cluster' ? (
                        <Switch
                          label="Hiện trên thanh chính"
                          checked={row.show_in_main_bar !== false}
                          onChange={(checked) => update({ show_in_main_bar: checked })}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              />
            </FormSection>
          ))}

          <FormFooter
            loading={saveMutation.isPending}
            preActions={
              <Button
                type="button"
                variant="secondary"
                disabled={resetMutation.isPending}
                onClick={() => {
                  if (!window.confirm('Khôi phục menu mặc định từ seed? Mọi tùy chỉnh DB sẽ bị xóa.')) return;
                  resetMutation.mutate();
                }}
              >
                Khôi phục mặc định
              </Button>
            }
          />
        </div>
      </form>
    </StructureLockProvider>
  );
}
