'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { themesApi } from '@/lib/services';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge, EmptyState, PageHeader } from '@/components/ui/Page';
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
} from '@/components/ui/EntityList';
import { useDeleteWithImpact } from '@/hooks/useDeleteWithImpact';

export default function TourThemesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const queryKey = useMemo(
    () => ['travel-styles', { search, page, perPage }],
    [search, page, perPage],
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      themesApi.list({
        search: search || undefined,
        page,
        per_page: perPage,
      }),
  });

  const linkedDelete = useDeleteWithImpact({
    queryKey: 'travel-styles',
    removeFn: (id) => themesApi.remove(id),
    impactFn: (id) => themesApi.deleteImpact(id),
    entityLabel: 'phong cách du lịch',
    successMessage: 'Đã xóa phong cách',
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div>
      <PageHeader
        eyebrow="Tour"
        title="Phong cách du lịch"
        description="Phong cách trải nghiệm — gắn vào gói tour/du thuyền để lọc trên site."
        actions={
          <HeadActions
            primary={
              <HeadCta
                href="/tours/themes/form/"
                icon={Plus}
                title="Thêm phong cách"
                subtitle="Phong cách mới"
              />
            }
          />
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder="Theo tên hoặc mã…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="phong cách"
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
              title="Chưa có phong cách"
              description="Tạo phong cách như Adventure, Luxury, Family…"
              action={
                <Link href="/tours/themes/form/">
                  <Button>
                    <Plus size={16} />
                    Thêm phong cách
                  </Button>
                </Link>
              }
            />
          ) : undefined
        }
      >
        {items.map((item) => (
          <EntityRow key={item.id}>
            <EntityMain
              title={item.name || '—'}
              href={`/tours/themes/form/?id=${item.id}`}
              slug={item.slug}
              badges={
                <Badge tone={item.is_active ? 'success' : 'neutral'}>
                  {item.is_active ? 'Đang bật' : 'Tắt'}
                </Badge>
              }
              facts={
                <>
                  <EntityFact label="Mã" accent>
                    {item.code}
                  </EntityFact>
                  <EntityFact label="Thứ tự">{item.sort}</EntityFact>
                </>
              }
            />
            <EntityHighlight label="Gói gắn" tone="stat">
              {item.packages_count}
            </EntityHighlight>
            <EntityActions
              editHref={`/tours/themes/form/?id=${item.id}`}
              onDelete={() => {
                linkedDelete.requestDelete({
                  id: item.id,
                  title: item.name || item.code || `#${item.id}`,
                });
              }}
            />
          </EntityRow>
        ))}
      </EntityList>

      {linkedDelete.modal}

      {meta && meta.last_page > 1 ? (
        <EntityPagination
          className="ui-list-meta--footer"
          page={meta.current_page}
          lastPage={meta.last_page}
          total={meta.total}
          perPage={perPage}
          unitLabel="phong cách"
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
