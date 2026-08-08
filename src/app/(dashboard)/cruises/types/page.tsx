'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { cruiseTypesApi } from '@/lib/services';
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

export default function CruiseTypesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const queryKey = useMemo(
    () => ['cruise-types', { search, isActive, page, perPage }],
    [search, isActive, page, perPage],
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      cruiseTypesApi.list({
        search: search || undefined,
        is_active: isActive === '' ? undefined : isActive === '1',
        page,
        per_page: perPage,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => cruiseTypesApi.remove(id),
    onSuccess: async () => {
      toast.success('Đã xóa danh mục du thuyền');
      await qc.invalidateQueries({ queryKey: ['cruise-types'] });
      await qc.invalidateQueries({ queryKey: ['packages-meta'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div>
      <PageHeader
        eyebrow="Du thuyền"
        title="Danh mục Du thuyền"
        description="Phân nhóm cruise (SEO parent) — ví dụ Hạ Long, Lan Hạ."
        actions={
          <HeadActions
            primary={
              <HeadCta
                href="/cruises/types/form/"
                icon={Plus}
                title="Thêm danh mục"
                subtitle="Phân nhóm du thuyền"
              />
            }
          />
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder="Theo tên hoặc slug…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="ui-toolbar__select">
          <Select
            label="Trạng thái"
            value={isActive}
            onChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
            placeholder="Mọi trạng thái"
            options={[
              { value: '1', label: 'Đang bật' },
              { value: '0', label: 'Tắt' },
            ]}
          />
        </div>
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="danh mục"
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
              title="Chưa có danh mục du thuyền"
              description="Tạo danh mục để gắn SEO parent cho chi tiết du thuyền."
              action={
                <Link href="/cruises/types/form/">
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
              src={item.banner?.url_thumb || item.banner?.url}
              alt={item.name || ''}
              href={`/cruises/types/form/?id=${item.id}`}
            />
            <EntityMain
              title={item.name || '—'}
              href={`/cruises/types/form/?id=${item.id}`}
              slug={item.seo?.slug_full || item.slug}
              publicHref={publicPageUrl(item.seo?.slug_full || item.slug)}
              badges={
                <Badge tone={item.is_active ? 'success' : 'neutral'}>
                  {item.is_active ? 'Đang bật' : 'Tắt'}
                </Badge>
              }
              facts={
                <>
                  {item.slug ? <EntityFact label="Đường dẫn">{item.slug}</EntityFact> : null}
                  <EntityFact label="Thứ tự">{item.sort}</EntityFact>
                </>
              }
            />
            <EntityActions
              editHref={`/cruises/types/form/?id=${item.id}`}
              onDelete={() => {
                if (confirm('Xóa danh mục du thuyền này?')) remove.mutate(item.id);
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
          unitLabel="danh mục"
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
