'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { commentsApi } from '@/lib/services';
import { Input, Select } from '@/components/ui/Field';
import { Badge, EmptyState, PageHeader } from '@/components/ui/Page';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityList,
  EntityMain,
  EntityPagination,
  EntityRow,
} from '@/components/ui/EntityList';
import { Button } from '@/components/ui/Button';

export default function CommentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const key = useMemo(
    () => ['comments', { search, status, page, perPage }],
    [search, status, page, perPage],
  );

  const listQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      commentsApi.list({
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: perPage,
      }),
  });

  const approve = useMutation({
    mutationFn: (id: number) => commentsApi.approve(id),
    onSuccess: async () => {
      toast.success('Đã duyệt');
      await qc.invalidateQueries({ queryKey: ['comments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reject = useMutation({
    mutationFn: (id: number) => commentsApi.reject(id),
    onSuccess: async () => {
      toast.success('Đã từ chối');
      await qc.invalidateQueries({ queryKey: ['comments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = (listQuery.data?.items ?? []) as Record<string, unknown>[];
  const meta = listQuery.data?.meta;

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title="Bình luận"
        description="Duyệt / từ chối bình luận bài viết."
      />
      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
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
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            placeholder="Tất cả"
            options={[
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'rejected', label: 'Từ chối' },
            ]}
          />
        </div>
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="bình luận"
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
            <EmptyState title="Không có bình luận" description="Hộp thư trống." />
          ) : undefined
        }
      >
        {items.map((row) => {
          const article = row.article as { title?: string } | null | undefined;
          return (
            <EntityRow key={String(row.id)}>
              <EntityMain
                title={String(row.full_name || `#${row.id}`)}
                badges={<Badge>{String(row.status || '')}</Badge>}
                facts={
                  <>
                    <span>{String(row.email || '')}</span>
                    {article?.title ? <span> · {article.title}</span> : null}
                    <div style={{ marginTop: 4, color: 'var(--admin-muted)' }}>
                      {String(row.content || '').slice(0, 200)}
                    </div>
                  </>
                }
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  onClick={() => approve.mutate(Number(row.id))}
                  disabled={String(row.status) === 'approved'}
                >
                  Duyệt
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => reject.mutate(Number(row.id))}
                  disabled={String(row.status) === 'rejected'}
                >
                  Từ chối
                </Button>
              </div>
            </EntityRow>
          );
        })}
      </EntityList>
    </div>
  );
}
