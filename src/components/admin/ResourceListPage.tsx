'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
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
import { useDeleteWithImpact } from '@/hooks/useDeleteWithImpact';
import type { DeleteImpact } from '@/lib/types';

type Row = Record<string, unknown> & { id: number };

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  queryKey: string;
  createHref: string;
  editHref: (id: number) => string;
  createLabel: string;
  createSubtitle?: string;
  unitLabel?: string;
  listFn: (q: Record<string, string | number | boolean | undefined>) => Promise<{
    items: Row[];
    meta?: { current_page: number; last_page: number; per_page: number; total: number };
  }>;
  removeFn?: (id: number) => Promise<unknown>;
  /** Khi có: hiện modal liệt kê trang liên kết trước khi xóa. */
  deleteImpactFn?: (id: number) => Promise<DeleteImpact>;
  /** Nhãn entity trong modal (vd. «điểm đến»). */
  deleteEntityLabel?: string;
  titleOf: (row: Row) => string;
  /** Slug hiển thị trên list; nếu có → tự gắn link mở trang public (giống list tour). */
  slugOf?: (row: Row) => string | null | undefined;
  /** Override URL public; mặc định = publicPageUrl(slugOf(row)). */
  publicHrefOf?: (row: Row) => string | null | undefined;
  badgeOf?: (row: Row) => ReactNode;
  factsOf?: (row: Row) => ReactNode;
  thumbOf?: (row: Row) => string | null | undefined;
  /** Hiện EntityFact Sort (mặc định bật khi row có sort). */
  showSort?: boolean;
  /** Badge «Đang bật» có thể bấm để đổi trạng thái. */
  activeToggle?: {
    of: (row: Row) => boolean;
    onChange: (row: Row, next: boolean) => Promise<unknown>;
  };
  statusOptions?: { value: string; label: string }[];
  statusKey?: string;
  /** Query cố định gửi kèm list (vd. cluster). */
  extraQuery?: Record<string, string | number | boolean | undefined>;
};

export function ResourceListPage({
  eyebrow,
  title,
  description,
  queryKey,
  createHref,
  editHref,
  createLabel,
  createSubtitle,
  unitLabel = 'mục',
  listFn,
  removeFn,
  deleteImpactFn,
  deleteEntityLabel,
  titleOf,
  slugOf,
  publicHrefOf,
  badgeOf,
  factsOf,
  thumbOf,
  showSort = true,
  activeToggle,
  statusOptions,
  statusKey = 'status',
  extraQuery,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const key = useMemo(
    () => [queryKey, { search, status, page, perPage, extraQuery }],
    [queryKey, search, status, page, perPage, extraQuery],
  );

  const listQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      listFn({
        search: search || undefined,
        [statusKey]: status || undefined,
        page,
        per_page: perPage,
        ...extraQuery,
      }),
  });

  const linkedDelete = useDeleteWithImpact({
    queryKey,
    removeFn: removeFn || (async () => undefined),
    impactFn: deleteImpactFn || (async () => ({ linked_count: 0, groups: [], warning: '' })),
    entityLabel: deleteEntityLabel || unitLabel,
    successMessage: 'Đã xóa',
  });

  const remove = useMutation({
    mutationFn: (id: number) => (removeFn ? removeFn(id) : Promise.resolve()),
    onSuccess: async () => {
      toast.success('Đã xóa');
      await qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ row, next }: { row: Row; next: boolean }) =>
      activeToggle ? activeToggle.onChange(row, next) : Promise.resolve(),
    onSuccess: async () => {
      toast.success('Đã cập nhật trạng thái');
      await qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const useImpactModal = !!removeFn && !!deleteImpactFn;

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <HeadActions
            primary={
              <HeadCta
                href={createHref}
                icon={Plus}
                title={createLabel}
                subtitle={createSubtitle || 'Thêm mới'}
              />
            }
          />
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder="Từ khóa…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        {statusOptions ? (
          <div className="ui-toolbar__select">
            <Select
              label="Trạng thái"
              value={status}
              onChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
              placeholder="Tất cả"
              options={statusOptions}
            />
          </div>
        ) : null}
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel={unitLabel}
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
              title="Chưa có dữ liệu"
              description="Bấm thêm mới để bắt đầu."
              action={
                <Link href={createHref}>
                  <Button>
                    <Plus size={16} />
                    {createLabel}
                  </Button>
                </Link>
              }
            />
          ) : undefined
        }
      >
        {items.map((row) => {
          const hasThumbSlot = typeof thumbOf === 'function';
          const thumb = hasThumbSlot ? thumbOf(row) : null;
          const extraFacts = factsOf?.(row);
          const sortFact =
            showSort && row.sort != null ? (
              <EntityFact label="Thứ tự">{String(row.sort)}</EntityFact>
            ) : null;
          const facts =
            extraFacts || sortFact ? (
              <>
                {extraFacts}
                {sortFact}
              </>
            ) : undefined;
          const slug = slugOf?.(row) || undefined;
          const publicHref =
            publicHrefOf?.(row) ?? (slug ? publicPageUrl(slug) : null) ?? null;

          return (
            <EntityRow key={row.id} media={hasThumbSlot}>
              {hasThumbSlot ? (
                <EntityThumb src={thumb} alt={titleOf(row)} href={editHref(row.id)} />
              ) : null}
              <EntityMain
                title={titleOf(row)}
                href={editHref(row.id)}
                slug={slug}
                publicHref={publicHref}
                badges={
                  <>
                    {badgeOf?.(row)}
                    {activeToggle ? (
                      <Badge
                        tone={activeToggle.of(row) ? 'success' : 'neutral'}
                        disabled={toggleActive.isPending}
                        title={activeToggle.of(row) ? 'Bấm để tắt' : 'Bấm để bật'}
                        onClick={() =>
                          toggleActive.mutate({
                            row,
                            next: !activeToggle.of(row),
                          })
                        }
                      >
                        {activeToggle.of(row) ? 'Đang bật' : 'Tắt'}
                      </Badge>
                    ) : null}
                  </>
                }
                facts={facts}
              />
              <EntityActions
                editHref={editHref(row.id)}
                onDelete={
                  removeFn
                    ? () => {
                        if (useImpactModal) {
                          linkedDelete.requestDelete({
                            id: row.id,
                            title: titleOf(row),
                          });
                          return;
                        }
                        if (confirm('Xóa mục này?')) remove.mutate(row.id);
                      }
                    : undefined
                }
              />
            </EntityRow>
          );
        })}
      </EntityList>

      {useImpactModal ? linkedDelete.modal : null}
    </div>
  );
}
