'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { categoriesApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, EmptyState, PageHeader } from '@/components/ui/Page';
import { HeadActions, HeadCta } from '@/components/ui/HeadActions';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityActions,
  EntityFact,
  EntityList,
  EntityMain,
  EntityPagination,
  EntityRow,
  EntityThumb,
} from '@/components/ui/EntityList';
import { publicPageUrl } from '@/lib/publicUrl';

export default function TourCategoriesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [countryId, setCountryId] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const queryKey = useMemo(
    () => ['tour-categories', { search, type, countryId, page, perPage }],
    [search, type, countryId, page, perPage],
  );

  const metaQuery = useQuery({
    queryKey: ['tour-categories-meta'],
    queryFn: () => categoriesApi.meta(),
  });

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      categoriesApi.list({
        search: search || undefined,
        type: type || undefined,
        country_id: countryId || undefined,
        page,
        per_page: perPage,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: async () => {
      toast.success('Đã xóa danh mục');
      await qc.invalidateQueries({ queryKey: ['tour-categories'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const typeOptions = listQuery.data?.type_options ?? metaQuery.data?.type_options ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Tour"
        title="Danh mục Tour"
        description="Phân nhóm tour theo thời lượng, vùng miền và tính chất — dùng cho listing & drawer menu Tour."
        actions={
          <HeadActions
            primary={
              <HeadCta
                href="/tours/categories/form/"
                icon={Plus}
                title="Thêm danh mục"
                subtitle="Nhóm lọc tour"
              />
            }
          />
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder="Theo tên danh mục…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="ui-toolbar__select">
          <Select
            label="Loại"
            value={type}
            onChange={(v) => {
              setPage(1);
              setType(v);
            }}
            placeholder="Mọi loại"
            options={typeOptions.map((t) => ({ value: t.value, label: t.label }))}
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
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="chủ đề"
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
              title="Chưa có danh mục"
              description="Tạo danh mục để tổ chức gói tour."
              action={
                <Link href="/tours/categories/form/">
                  <Button>
                    <Plus size={16} />
                    Thêm danh mục
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
              alt={item.name || ''}
              href={`/tours/categories/form/?id=${item.id}`}
            />
            <EntityMain
              title={item.name || '—'}
              href={`/tours/categories/form/?id=${item.id}`}
              slug={item.seo?.slug_full || item.slug}
              publicHref={publicPageUrl(item.seo?.slug_full || item.slug)}
              badges={
                <>
                  <Badge tone="primary">{item.type_label}</Badge>
                  <Badge tone={item.is_active ? 'success' : 'neutral'}>
                    {item.is_active ? 'Đang bật' : 'Tắt'}
                  </Badge>
                </>
              }
              facts={
                <>
                  {item.country?.name ? (
                    <EntityFact label="QG">{item.country.name}</EntityFact>
                  ) : null}
                  <EntityFact label="Thứ tự">{item.sort}</EntityFact>
                </>
              }
            />
            <EntityActions
              editHref={`/tours/categories/form/?id=${item.id}`}
              onDelete={() => {
                if (confirm('Xóa chủ đề này?')) remove.mutate(item.id);
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
          unitLabel="chủ đề"
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
