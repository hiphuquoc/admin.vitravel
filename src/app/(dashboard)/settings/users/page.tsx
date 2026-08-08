'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { usersApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
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
} from '@/components/ui/EntityList';
import type { UserListItem } from '@/lib/types';

export default function UsersPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_LIST_PER_PAGE);

  const metaQuery = useQuery({
    queryKey: ['users-meta'],
    queryFn: () => usersApi.meta(),
    enabled: can('users.view'),
  });

  const listKey = useMemo(
    () => ['users', { search, status, role, page, perPage }],
    [search, status, role, page, perPage],
  );

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        status: status || undefined,
        role: role || undefined,
        page,
        per_page: perPage,
      }),
    enabled: can('users.view'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: async () => {
      toast.success('Đã xóa người dùng');
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!can('users.view')) {
    return (
      <div>
        <PageHeader eyebrow="Cài đặt" title="Người dùng" />
        <EmptyState
          title="Không có quyền truy cập"
          description="Bạn cần quyền xem danh sách người dùng để truy cập trang này."
        />
      </div>
    );
  }

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const systemRoles = metaQuery.data?.system_roles ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        title="Người dùng"
        description="Quản lý tài khoản admin, vai trò hệ thống và phân quyền theo dự án."
        actions={
          can('users.manage') ? (
            <HeadActions
              primary={
                <HeadCta
                  href="/settings/users/form/"
                  icon={Plus}
                  title="Thêm người dùng"
                  subtitle="Tạo tài khoản mới"
                />
              }
            />
          ) : undefined
        }
      />

      <div className="ui-toolbar">
        <div className="ui-toolbar__search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên hoặc email…"
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
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Vô hiệu' },
            ]}
          />
        </div>
        {systemRoles.length > 0 ? (
          <div className="ui-toolbar__select">
            <Select
              label="Vai trò hệ thống"
              value={role}
              onChange={(v) => {
                setPage(1);
                setRole(v);
              }}
              placeholder="Tất cả"
              options={systemRoles}
            />
          </div>
        ) : null}
      </div>

      <EntityPagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total ?? 0}
        perPage={perPage}
        unitLabel="người dùng"
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
              title="Chưa có người dùng"
              description="Thêm tài khoản để cấp quyền truy cập admin."
              action={
                can('users.manage') ? (
                  <Link href="/settings/users/form/">
                    <Button>
                      <Plus size={16} />
                      Thêm người dùng
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : undefined
        }
      >
        {items.map((row: UserListItem) => (
          <EntityRow key={row.id}>
            <EntityMain
              title={row.name}
              href={`/settings/users/form/?id=${row.id}`}
              badges={
                <>
                  <Badge tone={row.is_super_admin ? 'primary' : 'neutral'}>
                    {row.role_label || row.role}
                  </Badge>
                  <Badge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Đang hoạt động' : 'Vô hiệu'}
                  </Badge>
                </>
              }
              facts={
                <>
                  <EntityFact label="Email">{row.email}</EntityFact>
                  {(row.projects ?? []).map((p) => (
                    <EntityFact key={p.id} label={p.name}>
                      {p.role || '—'}
                    </EntityFact>
                  ))}
                </>
              }
            />
            <EntityActions
              editHref={`/settings/users/form/?id=${row.id}`}
              onDelete={
                can('users.manage')
                  ? () => {
                      if (confirm(`Xóa người dùng "${row.name}"?`)) remove.mutate(row.id);
                    }
                  : undefined
              }
            />
          </EntityRow>
        ))}
      </EntityList>
    </div>
  );
}
