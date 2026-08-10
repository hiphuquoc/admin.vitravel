'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Shield, UserRound } from 'lucide-react';
import clsx from 'clsx';
import toast from '@/lib/toast';
import { usersApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import { Input, MultiSelect, Select, Switch } from '@/components/ui/Field';
import { EmptyState, PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { FormFooter } from '@/components/ui/FormFooter';
import { Repeater } from '@/components/ui/Repeater';
import { PageLoader } from '@/components/ui/PageLoader';
import type { PermissionGroup, UserDetail } from '@/lib/types';

type ProjectRow = {
  key: string;
  project_id: string;
  role: string;
  grant: string[];
  advancedOpen: boolean;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  is_active: boolean;
  role: string;
  projects: ProjectRow[];
};

const emptyProjectRow = (): ProjectRow => ({
  key: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  project_id: '',
  role: 'editor',
  grant: [],
  advancedOpen: false,
});

const empty: FormState = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  is_active: true,
  role: 'staff',
  projects: [],
};

function permissionOptions(groups: PermissionGroup[]) {
  return groups.flatMap((g) =>
    g.items.map((item) => ({ value: item.key, label: `${g.label}: ${item.label}` })),
  );
}

function FormInner() {
  const search = useSearchParams();
  const id = search.get('id') ? Number(search.get('id')) : null;
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const snapshotRef = useRef(JSON.stringify(empty));
  const canManage = can('users.manage');

  const metaQuery = useQuery({
    queryKey: ['users-meta'],
    queryFn: () => usersApi.meta(),
    enabled: canManage,
  });

  const detailQuery = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id!),
    enabled: !!id && canManage,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data as UserDetail;
    const projects: ProjectRow[] = (d.projects ?? []).map((p, i) => ({
      key: `proj-${p.id}-${i}`,
      project_id: String(p.project_id ?? p.id),
      role: p.role || 'editor',
      grant: [...(p.permissions?.grant ?? [])],
      advancedOpen: false,
    }));

    const next: FormState = {
      name: d.name,
      email: d.email,
      password: '',
      password_confirmation: '',
      is_active: d.is_active,
      role: d.role,
      projects,
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [detailQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        is_active: form.is_active,
        role: form.role,
        projects: form.projects
          .filter((row) => row.project_id)
          .map((row) => ({
            project_id: Number(row.project_id),
            role: row.role,
            permissions: row.grant.length ? { grant: row.grant } : undefined,
          })),
      };

      if (isNew || form.password.trim()) {
        body.password = form.password;
      }

      return isNew ? usersApi.create(body) : usersApi.update(id!, body);
    },
    onSuccess: async (data) => {
      toast.success(isNew ? 'Đã tạo người dùng' : 'Đã cập nhật người dùng');
      await qc.invalidateQueries({ queryKey: ['users'] });
      if (isNew && data.id) {
        router.replace(`/settings/users/form/?id=${data.id}`);
      } else {
        snapshotRef.current = JSON.stringify(form);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const meta = metaQuery.data;
  const systemRoles = meta?.system_roles ?? [];
  const projectRoles = meta?.project_roles ?? [];
  const manageableProjects = meta?.projects ?? [];
  const permissionGroups = meta?.permission_groups ?? [];
  const permOptions = useMemo(() => permissionOptions(permissionGroups), [permissionGroups]);

  const usedProjectIds = useMemo(
    () => new Set(form.projects.map((r) => r.project_id).filter(Boolean)),
    [form.projects],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  if (!canManage) {
    return (
      <div>
        <PageHeader eyebrow="Cài đặt" title={isNew ? 'Thêm người dùng' : 'Sửa người dùng'} />
        <EmptyState
          title="Không có quyền chỉnh sửa"
          description="Chỉ quản trị hệ thống mới tạo / sửa tài khoản trong mục Người dùng. Hồ sơ cá nhân: Tài khoản → Hồ sơ của tôi."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        id={id}
        title={isNew ? 'Thêm người dùng' : 'Sửa người dùng'}
        description="Tài khoản, vai trò hệ thống và phân quyền theo từng dự án."
      />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!canManage) {
            toast.error('Không có quyền lưu người dùng.');
            return;
          }
          if (isNew && !form.password.trim()) {
            toast.error('Mật khẩu là bắt buộc khi tạo tài khoản mới.');
            return;
          }
          if (form.password.trim() && form.password !== form.password_confirmation) {
            toast.error('Xác nhận mật khẩu không khớp.');
            return;
          }
          if (form.role === 'staff' && form.projects.filter((r) => r.project_id).length === 0) {
            toast.error('Nhân sự cần được gán ít nhất một dự án.');
            return;
          }
          save.mutate();
        }}
        className="ui-form-stack"
      >
        <FormSection
          index={1}
          icon={UserRound}
          title="Tài khoản"
          description="Thông tin đăng nhập và vai trò hệ thống."
        >
          <FormCluster>
            <Input
              label="Họ tên"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              disabled={!canManage}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
              disabled={!canManage}
            />
            <Input
              label={isNew ? 'Mật khẩu' : 'Mật khẩu mới'}
              type="password"
              autoComplete={isNew ? 'new-password' : 'off'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required={isNew}
              hint={isNew ? undefined : 'Để trống nếu không đổi'}
              disabled={!canManage}
            />
            <Input
              label="Xác nhận mật khẩu"
              type="password"
              autoComplete="off"
              value={form.password_confirmation}
              onChange={(e) => set('password_confirmation', e.target.value)}
              disabled={!canManage}
            />
            <Switch
              label="Đang hoạt động"
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
              disabled={!canManage}
            />
            <Select
              label="Vai trò hệ thống"
              value={form.role}
              onChange={(v) => set('role', v)}
              options={systemRoles}
              disabled={!canManage}
              hint={
                !meta?.can_assign_super_admin
                  ? 'Chỉ siêu quản trị mới gán quyền hệ thống cao.'
                  : undefined
              }
            />
          </FormCluster>
        </FormSection>

        <FormSection
          index={2}
          icon={Shield}
          title="Dự án & vai trò"
          description="Gán dự án và vai trò trong từng dự án. Mỗi dự án chỉ chọn một lần."
        >
          <Repeater
            items={form.projects}
            onChange={(projects) => set('projects', projects)}
            createItem={emptyProjectRow}
            addLabel="Thêm dự án"
            lockStructure={!canManage}
            renderItem={(row, index, { update, remove }) => {
              const projectOptions = manageableProjects
                .filter(
                  (p) =>
                    String(p.id) === row.project_id || !usedProjectIds.has(String(p.id)),
                )
                .map((p) => ({ value: String(p.id), label: p.name }));

              const projectName =
                manageableProjects.find((p) => String(p.id) === row.project_id)?.name ||
                'Dự án';

              return (
                <div className="ui-form-stack" style={{ width: '100%' }}>
                  <FormCluster>
                    <Select
                      value={row.project_id}
                      onChange={(v) => update({ project_id: v })}
                      options={projectOptions}
                      placeholder="Chọn dự án…"
                      disabled={!canManage}
                    />
                    <Select
                      label="Vai trò dự án"
                      value={row.role}
                      onChange={(v) => update({ role: v })}
                      options={projectRoles}
                      disabled={!canManage}
                    />
                  </FormCluster>

                  {row.project_id ? (
                    <div className="ui-form-cluster">
                      <button
                        type="button"
                        className={clsx(
                          'ui-btn ui-btn--secondary ui-btn--sm',
                          row.advancedOpen && 'ui-btn--active',
                        )}
                        onClick={() => update({ advancedOpen: !row.advancedOpen })}
                        disabled={!canManage}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: row.advancedOpen ? 'rotate(180deg)' : undefined,
                            transition: 'transform 0.15s',
                          }}
                        />
                        Tùy chỉnh quyền nâng cao — {projectName}
                      </button>
                      {row.advancedOpen ? (
                        <div className="ui-form-grid">
                          <MultiSelect
                            label="Cấp thêm quyền (grant)"
                            hint="Bổ sung quyền ngoài vai trò mặc định. Để trống = chỉ dùng quyền theo vai trò."
                            options={permOptions}
                            value={row.grant}
                            onChange={(vals) => update({ grant: vals.map(String) })}
                            coerceNumber={false}
                            disabled={!canManage}
                            searchable
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </FormSection>

        <FormFooter
          cancelHref="/settings/users/"
          loading={save.isPending}
          showAiTranslate={false}
          submitDisabled={!canManage}
        />
      </form>
    </div>
  );
}

export default function UserFormPage() {
  return (
    <Suspense fallback={<PageLoader variant="inline" label="Đang tải form…" />}>
      <FormInner />
    </Suspense>
  );
}
