'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { leadsApi } from '@/lib/services';
import { Input, Select } from '@/components/ui/Field';
import { Badge, EmptyState, PageHeader } from '@/components/ui/Page';
import {
  DEFAULT_LIST_PER_PAGE,
  EntityList,
  EntityMain,
  EntityPagination,
  EntityRow,
} from '@/components/ui/EntityList';

type LeadKind = 'quick' | 'custom' | 'contacts';

const CONFIG: Record<
  LeadKind,
  {
    title: string;
    queryKey: string;
    list: typeof leadsApi.quickInquiries;
    updateStatus: (id: number, status: string) => Promise<unknown>;
  }
> = {
  quick: {
    title: 'Yêu cầu nhanh',
    queryKey: 'leads-quick',
    list: leadsApi.quickInquiries,
    updateStatus: leadsApi.updateQuickInquiryStatus,
  },
  custom: {
    title: 'Tour riêng',
    queryKey: 'leads-custom',
    list: leadsApi.customTours,
    updateStatus: leadsApi.updateCustomTourStatus,
  },
  contacts: {
    title: 'Liên hệ',
    queryKey: 'leads-contacts',
    list: leadsApi.contacts,
    updateStatus: leadsApi.updateContactStatus,
  },
};

export function LeadsInboxPage({ kind }: { kind: LeadKind }) {
  const cfg = CONFIG[kind];
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const key = useMemo(
    () => [cfg.queryKey, { search, status, page, perPage }],
    [cfg.queryKey, search, status, page, perPage],
  );

  const listQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      cfg.list({
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: perPage,
      }),
  });

  const update = useMutation({
    mutationFn: ({ id, status: next }: { id: number; status: string }) =>
      cfg.updateStatus(id, next),
    onSuccess: async () => {
      toast.success('Đã cập nhật trạng thái');
      await qc.invalidateQueries({ queryKey: [cfg.queryKey] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = (listQuery.data?.items ?? []) as Record<string, unknown>[];
  const meta = listQuery.data?.meta;
  const statuses = listQuery.data?.statuses ?? [
    { value: 'new', label: 'Mới' },
    { value: 'contacted', label: 'Đã liên hệ' },
    { value: 'quoted', label: 'Đã báo giá' },
    { value: 'closed', label: 'Đóng' },
    { value: 'spam', label: 'Spam' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title={cfg.title}
        description="Quản lý yêu cầu — đổi trạng thái trực tiếp."
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
            options={statuses}
          />
        </div>
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="lead"
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
          items.length === 0 ? <EmptyState title="Không có yêu cầu" description="Hộp thư trống." /> : undefined
        }
      >
        {items.map((row) => (
          <EntityRow key={String(row.id)}>
            <EntityMain
              title={String(row.name || `#${row.id}`)}
              facts={
                <>
                  <span>{String(row.email || '')}</span>
                  {row.phone ? <span> · {String(row.phone)}</span> : null}
                  {row.message || row.destination ? (
                    <div style={{ marginTop: 4, color: 'var(--admin-muted)' }}>
                      {String(row.message || row.destination || '').slice(0, 160)}
                    </div>
                  ) : null}
                </>
              }
              badges={<Badge>{String(row.status || '')}</Badge>}
            />
            <div style={{ display: 'grid', gap: 8, minWidth: 160 }}>
              <Select
                label="Đổi trạng thái"
                value={String(row.status || '')}
                onChange={(v) => update.mutate({ id: Number(row.id), status: v })}
                options={statuses}
              />
            </div>
          </EntityRow>
        ))}
      </EntityList>
    </div>
  );
}
