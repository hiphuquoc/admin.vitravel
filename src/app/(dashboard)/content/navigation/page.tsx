'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, LayoutList, Menu } from 'lucide-react';
import toast from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { navigationMenuApi } from '@/lib/services';
import { useEditLocale } from '@/hooks/useEditLocale';
import {
  beginFormHydration,
  lockFormHydration,
  shouldHydrateScopedQuery,
  useResetFormOnProjectChange,
} from '@/hooks/useFormHydration';
import { createScopedQueryFn, useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import { PageHeader } from '@/components/ui/Page';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormSection } from '@/components/ui/FormSection';
import { Input, Switch, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Repeater } from '@/components/ui/Repeater';
import { StructureLockProvider } from '@/hooks/useStructureLock';
import { asLocaleOptions, type LocaleOption } from '@/lib/locale';
import type { SelectOption } from '@/components/ui/Select';

type NavCategoryOption = {
  slug: string;
  label: string;
  count: number;
  meta?: string;
};

type HubOption = {
  value: string;
  kind: string;
  label: string;
  reference: string | null;
};

type NavItem = {
  id?: number | null;
  zone: string;
  kind: string;
  kind_label?: string;
  item_key: string;
  reference?: string | null;
  hub_value?: string;
  sort: number;
  is_active: boolean;
  show_in_main_bar?: boolean;
  label?: string | null;
  lead_label?: string | null;
  meta?: string | null;
  category_slugs?: string[];
  config?: {
    category_slugs?: string[];
    show_in_main_bar?: boolean;
  };
};

function catalogKeyForItem(item: NavItem): string {
  if (item.hub_value) return item.hub_value;
  if (item.kind === 'tours_menu') return 'tours';
  if (item.kind === 'cruise_menu') return 'cruise';
  if (item.kind === 'service_cluster' && item.reference) return `cluster:${item.reference}`;
  return '';
}

function buildItemFromHub(hub: HubOption, sort: number, labelOverride?: string): NavItem {
  const itemKey =
    hub.kind === 'service_cluster' && hub.reference
      ? `svc_${hub.reference}`
      : hub.value;

  return {
    zone: 'main',
    kind: hub.kind,
    item_key: itemKey,
    reference: hub.reference,
    hub_value: hub.value,
    sort,
    is_active: true,
    show_in_main_bar: true,
    label: labelOverride ?? hub.label,
    lead_label: `Tất cả ${hub.label.toLowerCase()}`,
    meta: '',
    category_slugs: [],
    config: { category_slugs: [], show_in_main_bar: true },
  };
}

function normalizeCategorySlugsForSave(
  slugs: string[] | undefined,
  catalog: NavCategoryOption[],
): string[] {
  const all = catalog.map((row) => row.slug).filter(Boolean);
  const picked = (slugs ?? []).filter((slug) => all.includes(slug));
  if (picked.length === 0 || picked.length >= all.length) {
    return [];
  }
  return picked;
}

export default function NavigationMenuPage() {
  const qc = useQueryClient();
  const { projectCode } = useAuth();
  const { locale, setLocale } = useEditLocale();
  const [items, setItems] = useState<NavItem[]>([]);
  const snapshot = useRef('');
  const hydrateKeyRef = useRef<string | null>(null);

  const navQueryKey = useScopedQueryKey('navigation-menu', locale);

  const { data, isLoading } = useQuery({
    queryKey: navQueryKey,
    queryFn: createScopedQueryFn(() => navigationMenuApi.get(locale)),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const languages = asLocaleOptions(data?.languages) ?? ([] as LocaleOption[]);
  const hubOptions = (data?.hub_options as HubOption[]) ?? [];
  const categoryCatalog = (data?.category_catalog as Record<string, NavCategoryOption[]>) ?? {};

  const hubSelectOptions: SelectOption[] = useMemo(
    () => hubOptions.map((hub) => ({ value: hub.value, label: hub.label })),
    [hubOptions],
  );

  const resetForm = useCallback(() => {
    setItems([]);
    snapshot.current = '';
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!data) return;
    if (!shouldHydrateScopedQuery(navQueryKey, projectCode)) return;
    if (!beginFormHydration(hydrateKeyRef, 'navigation-menu', locale)) return;
    const rows = ((data.items as NavItem[]) || []).map((row) => ({
      ...row,
      hub_value: row.hub_value || catalogKeyForItem(row),
      category_slugs: row.category_slugs ?? row.config?.category_slugs ?? [],
    }));
    setItems(rows);
    snapshot.current = JSON.stringify(rows);
  }, [data, navQueryKey, projectCode, locale]);

  const dirty = useMemo(() => JSON.stringify(items) !== snapshot.current, [items]);

  const mainItems = useMemo(
    () => items.filter((row) => row.zone === 'main').sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [items],
  );

  const preservedItems = useMemo(
    () => items.filter((row) => row.zone !== 'main'),
    [items],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payloadItems = [
        ...mainItems.map((row, index) => {
          const catalogKey = catalogKeyForItem(row);
          const catalog = categoryCatalog[catalogKey] ?? [];
          const category_slugs = normalizeCategorySlugsForSave(row.category_slugs, catalog);

          return {
            ...row,
            zone: 'main',
            sort: index + 1,
            category_slugs,
            config: {
              ...(row.config ?? {}),
              category_slugs,
              show_in_main_bar: row.show_in_main_bar !== false,
            },
          };
        }),
        ...preservedItems,
      ];

      return navigationMenuApi.update({ locale, items: payloadItems });
    },
    onSuccess: async () => {
      toast.success('Đã lưu menu public.');
      snapshot.current = JSON.stringify(items);
      lockFormHydration(hydrateKeyRef, 'navigation-menu', locale);
      await qc.invalidateQueries({ queryKey: navQueryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => navigationMenuApi.reset(),
    onSuccess: async () => {
      toast.success('Đã khôi phục menu mặc định từ seed.');
      await qc.invalidateQueries({ queryKey: navQueryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMainItems = (zoneItems: NavItem[]) => {
    const merged = [
      ...zoneItems.map((row, index) => ({ ...row, zone: 'main', sort: index + 1 })),
      ...preservedItems,
    ];
    setItems(merged);
  };

  const applyHub = (row: NavItem, hubValue: string, update: (patch: Partial<NavItem>) => void) => {
    const hub = hubOptions.find((option) => option.value === hubValue);
    if (!hub) return;

    const next = buildItemFromHub(hub, row.sort, row.label || undefined);
    update({
      kind: next.kind,
      reference: next.reference,
      hub_value: hub.value,
      item_key: next.item_key,
      category_slugs: [],
      config: { category_slugs: [], show_in_main_bar: row.show_in_main_bar !== false },
      lead_label: row.lead_label || next.lead_label,
    });
  };

  const toggleCategory = (
    row: NavItem,
    slug: string,
    update: (patch: Partial<NavItem>) => void,
  ) => {
    const catalogKey = catalogKeyForItem(row);
    const catalog = categoryCatalog[catalogKey] ?? [];
    const allSlugs = catalog.map((entry) => entry.slug).filter(Boolean);
    if (allSlugs.length === 0) return;

    let stored = row.category_slugs ?? [];
    if (stored.length === 0) {
      stored = [...allSlugs];
    }

    const next = stored.includes(slug)
      ? stored.filter((value) => value !== slug)
      : [...stored, slug];

    const normalized = normalizeCategorySlugsForSave(next, catalog);
    update({
      category_slugs: normalized,
      config: { ...(row.config ?? {}), category_slugs: normalized },
    });
  };

  const isCategoryChecked = (row: NavItem, slug: string): boolean => {
    const catalogKey = catalogKeyForItem(row);
    const catalog = categoryCatalog[catalogKey] ?? [];
    const stored = row.category_slugs ?? [];
    if (stored.length === 0) return true;
    return stored.includes(slug);
  };

  if (isLoading && !data) {
    return <p className="p-6 text-sm text-gray-500">Đang tải menu…</p>;
  }

  const isCustomized = Boolean(data?.is_customized);
  const defaultHub = hubOptions[0];

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
            description="Cấu hình nhãn trên thanh menu, chọn hub và tick danh mục hiển thị trong drawer. Menu ⋯ và nút CTA giữ mặc định seed."
          />

          <LocaleSwitcher
            languages={languages}
            value={locale}
            onChange={(c) => setLocale(c, { confirmIfDirty: true, isDirty: dirty })}
          />

          {!isCustomized ? (
            <div className="ui-form-notices">
              <div className="ui-info-notice" role="status">
                <Info size={18} strokeWidth={2.2} aria-hidden />
                <div className="ui-info-notice__body">
                  <p className="ui-info-notice__title">Đang dùng menu mặc định từ seed dự án</p>
                  <p className="ui-info-notice__text">
                    Chỉnh sửa bất kỳ mục nào bên dưới rồi bấm Lưu để ghi đè theo project hiện tại.
                    Trước khi lưu, trang public vẫn hiển thị cấu hình seed.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <FormSection
            icon={Menu}
            title="Thanh menu chính"
            description="Mỗi mục = một nhãn trên header. Sắp xếp bằng nút bên trái; chỉnh hub, nhãn và danh mục drawer bên trong."
          >
            <Repeater
              items={mainItems}
              onChange={updateMainItems}
              lockStructure={false}
              addLabel="Thêm mục menu"
              createItem={() =>
                defaultHub
                  ? buildItemFromHub(defaultHub, mainItems.length + 1)
                  : {
                      zone: 'main',
                      kind: 'tours_menu',
                      item_key: `hub_${Date.now()}`,
                      hub_value: 'tours',
                      sort: mainItems.length + 1,
                      is_active: true,
                      label: '',
                      category_slugs: [],
                    }
              }
              keyOf={(row) => row.item_key}
              renderItem={(row, _index, { update }) => {
                const catalogKey = catalogKeyForItem(row);
                const categories = categoryCatalog[catalogKey] ?? [];
                const hubValue = row.hub_value || catalogKey;
                const visible =
                  row.is_active !== false && row.show_in_main_bar !== false;
                const selectedCount = categories.filter((cat) =>
                  isCategoryChecked(row, cat.slug),
                ).length;

                return (
                  <div className="nav-menu-editor">
                    <div className="nav-menu-editor__primary">
                      <Select
                        label="Hub / loại menu"
                        options={hubSelectOptions}
                        value={hubValue}
                        onChange={(value) => applyHub(row, value, update)}
                      />
                      <div className="nav-menu-editor__visibility">
                        <span className="nav-menu-editor__visibility-label">
                          Trên header
                        </span>
                        <Switch
                          label={visible ? 'Đang hiện' : 'Đang ẩn'}
                          checked={visible}
                          onChange={(checked) =>
                            update({
                              is_active: checked,
                              show_in_main_bar: checked,
                              config: {
                                ...(row.config ?? {}),
                                show_in_main_bar: checked,
                              },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="nav-menu-editor__labels">
                      <Input
                        label="Nhãn trên thanh menu"
                        value={row.label || ''}
                        onChange={(e) => update({ label: e.target.value })}
                        placeholder="VD: Tour trọn gói, Lưu trú…"
                      />
                      <Input
                        label="Dòng dẫn hub"
                        value={row.lead_label || ''}
                        onChange={(e) => update({ lead_label: e.target.value })}
                        placeholder="VD: Tất cả tour"
                      />
                    </div>

                    <Input
                      label="Mô tả phụ trong drawer"
                      value={row.meta || ''}
                      onChange={(e) => update({ meta: e.target.value })}
                      placeholder="Một dòng mô tả dưới link hub"
                    />

                    <div className="nav-menu-editor__cats">
                      <div className="nav-menu-editor__cats-head">
                        <div>
                          <p className="nav-menu-editor__cats-title">
                            Danh mục trong drawer
                          </p>
                          <p className="nav-menu-editor__cats-hint">
                            Bỏ chọn để ẩn. Để trống (= tất cả đang chọn) sẽ hiện toàn bộ
                            danh mục hiện có.
                          </p>
                        </div>
                        {categories.length > 0 ? (
                          <span className="nav-menu-editor__cats-count">
                            {selectedCount}/{categories.length}
                          </span>
                        ) : null}
                      </div>

                      {categories.length > 0 ? (
                        <div className="nav-menu-editor__cat-grid" role="group">
                          {categories.map((cat) => {
                            const checked = isCategoryChecked(row, cat.slug);
                            return (
                              <label
                                key={cat.slug}
                                className={
                                  checked
                                    ? 'nav-menu-editor__cat is-checked'
                                    : 'nav-menu-editor__cat'
                                }
                              >
                                <input
                                  type="checkbox"
                                  className="nav-menu-editor__cat-input"
                                  checked={checked}
                                  onChange={() =>
                                    toggleCategory(row, cat.slug, update)
                                  }
                                />
                                <span className="nav-menu-editor__cat-body">
                                  <span className="nav-menu-editor__cat-label">
                                    {cat.label}
                                  </span>
                                  {cat.count > 0 ? (
                                    <span className="nav-menu-editor__cat-meta">
                                      {cat.count}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="nav-menu-editor__cats-empty">
                          Chưa có danh mục CMS cho hub này — thêm danh mục tour / loại du
                          thuyền / danh mục dịch vụ trước.
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </FormSection>

          <FormSection
            icon={LayoutList}
            title="Menu ⋯ (thêm) & CTA"
            description="Tạm dùng cấu hình mặc định từ seed dự án — chưa chỉnh trong admin."
          >
            <div className="ui-readonly-panel">
              <p>
                Các mục <strong>Về chúng tôi</strong>, <strong>Blog</strong>, liên kết trang tĩnh và nút{' '}
                <strong>Tour riêng</strong> vẫn lấy từ seed. Phần chỉnh sửa menu ⋯ sẽ bổ sung sau.
              </p>
            </div>
          </FormSection>

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
