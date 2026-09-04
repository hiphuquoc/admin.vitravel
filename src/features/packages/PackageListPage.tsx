'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { cruisePackagesApi, packagesApi, type PackageType } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import {
  Badge,
  EmptyState,
  PageHeader,
  formatMoney,
  statusLabel,
  statusTone,
} from '@/components/ui/Page';
import { HeadActions, HeadCta } from '@/components/ui/HeadActions';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityActions,
  EntityFact,
  EntityHighlight,
  EntityList,
  EntityMain,
  EntityPagination,
  EntityRow,
  EntityThumb,
} from '@/components/ui/EntityList';
import { publicPageUrl } from '@/lib/publicUrl';

const COPY: Record<
  PackageType,
  {
    eyebrow: string;
    title: string;
    description: string;
    listHref: string;
    formHref: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyDesc: string;
    deleteConfirm: string;
    deletedMsg: string;
    queryKey: string;
    addTitle: string;
    addSubtitle: string;
  }
> = {
  tour: {
    eyebrow: 'Tour',
    title: 'Chi tiết Tour',
    description: 'Quản lý sản phẩm tour — lọc nhanh, chỉnh sửa và xuất bản.',
    listHref: '/tours/packages/',
    formHref: '/tours/packages/form/',
    searchPlaceholder: 'Theo tiêu đề tour…',
    emptyTitle: 'Chưa có chi tiết tour',
    emptyDesc: 'Tạo gói đầu tiên để bắt đầu bán tour trên site.',
    deleteConfirm: 'Xóa chi tiết tour này?',
    deletedMsg: 'Đã xóa chi tiết tour',
    queryKey: 'packages',
    addTitle: 'Thêm chi tiết',
    addSubtitle: 'Tạo gói tour mới',
  },
  cruise: {
    eyebrow: 'Du thuyền',
    title: 'Chi tiết Du thuyền',
    description: 'Quản lý sản phẩm du thuyền — lọc nhanh, chỉnh sửa và xuất bản.',
    listHref: '/cruises/packages/',
    formHref: '/cruises/packages/form/',
    searchPlaceholder: 'Theo tiêu đề du thuyền…',
    emptyTitle: 'Chưa có chi tiết du thuyền',
    emptyDesc: 'Tạo gói đầu tiên để bán du thuyền trên site.',
    deleteConfirm: 'Xóa chi tiết du thuyền này?',
    deletedMsg: 'Đã xóa chi tiết du thuyền',
    queryKey: 'cruise-packages',
    addTitle: 'Thêm chi tiết',
    addSubtitle: 'Tạo gói du thuyền mới',
  },
};

export function PackageListPage({ kind }: { kind: PackageType }) {
  const copy = COPY[kind];
  const api = kind === 'cruise' ? cruisePackagesApi : packagesApi;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const queryKey = useMemo(
    () => [copy.queryKey, { search, countryId, status, page, perPage }],
    [copy.queryKey, search, countryId, status, page, perPage],
  );

  const metaQuery = useQuery({
    queryKey: ['packages-meta'],
    queryFn: () => api.meta(),
  });

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      api.list({
        search: search || undefined,
        country_id: countryId || undefined,
        status: status || undefined,
        page,
        per_page: perPage,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: async () => {
      toast.success(copy.deletedMsg);
      await qc.invalidateQueries({ queryKey: [copy.queryKey] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <HeadActions
            primary={
              <HeadCta
                href={copy.formHref}
                icon={Plus}
                title={copy.addTitle}
                subtitle={copy.addSubtitle}
              />
            }
          />
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="ui-toolbar__select">
          <Select
            label="Điểm đến"
            value={countryId}
            onChange={(v) => {
              setPage(1);
              setCountryId(v);
            }}
            placeholder="Tất cả quốc gia"
            searchable
            options={(metaQuery.data?.countries ?? []).map((c) => ({
              value: c.id,
              label: c.name || `#${c.id}`,
            }))}
          />
        </div>
        <div className="ui-toolbar__select">
          <Select
            label="Trạng thái"
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            placeholder="Mọi trạng thái"
            options={(metaQuery.data?.statuses ?? []).map((s) => ({
              value: s.value,
              label: s.label,
            }))}
          />
        </div>
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="gói"
        loading={listQuery.isLoading}
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPage(1);
          setPerPage(n);
        }}
      />

      <EntityList
        loading={listQuery.isLoading}
        empty={
          items.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle}
              description={copy.emptyDesc}
              action={
                <Link href={copy.formHref}>
                  <Button>
                    <Plus size={16} />
                    Thêm gói
                  </Button>
                </Link>
              }
            />
          ) : undefined
        }
      >
        {items.map((item) => (
          <EntityRow key={item.id} media>
            <EntityThumb
              src={item.cover?.url_thumb || item.cover?.url}
              alt={item.title || ''}
              href={`${copy.formHref}?id=${item.id}`}
            />
            <EntityMain
              title={item.title || '—'}
              href={`${copy.formHref}?id=${item.id}`}
              slug={item.seo?.slug_full || item.seo?.slug}
              publicHref={publicPageUrl(item.seo?.slug_full || item.seo?.slug)}
              badges={
                <>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  {item.is_featured ? <Badge tone="primary">Nổi bật</Badge> : null}
                  {item.is_hot_deal ? <Badge tone="warning">Ưu đãi hot</Badge> : null}
                </>
              }
              facts={
                <>
                  {item.code ? (
                    <EntityFact label="Mã" accent>
                      {item.code}
                    </EntityFact>
                  ) : null}
                  <EntityFact label="TG">
                    {item.duration_days}N{item.duration_nights}Đ
                  </EntityFact>
                  {item.country?.name ? (
                    <EntityFact label="QG">{item.country.name}</EntityFact>
                  ) : null}
                  {kind === 'cruise' && (item.cruise_type_name || item.cruise_type) ? (
                    <EntityFact label="Loại">{item.cruise_type_name || item.cruise_type}</EntityFact>
                  ) : null}
                  {(item.travel_styles ?? []).slice(0, 2).map((s) => (
                    <EntityFact key={s.id}>{s.name}</EntityFact>
                  ))}
                </>
              }
            />
            <EntityHighlight label="Giá từ" tone="price">
              {formatMoney(item.price_from, item.currency)}
            </EntityHighlight>
            <EntityActions
              editHref={`${copy.formHref}?id=${item.id}`}
              onDelete={() => {
                if (confirm(copy.deleteConfirm)) remove.mutate(item.id);
              }}
            />
          </EntityRow>
        ))}
      </EntityList>

      {meta && meta.last_page > 1 ? (
        <EntityPagination
          className="ui-list-meta--footer"
          page={meta.current_page}
          lastPage={meta.last_page}
          total={meta.total}
          perPage={perPage}
          unitLabel="gói"
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPage(1);
            setPerPage(n);
          }}
        />
      ) : null}
    </div>
  );
}
