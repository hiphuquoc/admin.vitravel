'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import toast from '@/lib/toast';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Switch } from '@/components/ui/Field';
import { EmptyState, PageHeader } from '@/components/ui/Page';
import { EntityList, EntityMain, EntityRow } from '@/components/ui/EntityList';
import { FormCluster, FormSection } from '@/components/ui/FormSection';

type PromptItem = {
  id?: number;
  key: string;
  name: string;
  category?: string;
  description?: string | null;
  version?: number;
  system: string;
  user: string;
  output_format?: string;
  variables?: string[];
  entity_types?: string[];
  is_active?: boolean;
  is_customized?: boolean;
  updated_at?: string | null;
  source?: string;
};

type UsageItem = {
  id: number;
  prompt_key: string;
  feature?: string | null;
  entity_type?: string | null;
  provider?: string | null;
  model?: string | null;
  latency_ms?: number | null;
  success: boolean;
  error_message?: string | null;
  created_at?: string | null;
};

export default function AiPromptsSettingsPage() {
  const { can } = useAuth();
  const canManage = can('ai.manage');
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptItem | null>(null);

  const listQuery = useQuery({
    queryKey: ['ai-prompts'],
    queryFn: () =>
      apiRequest<{ items: PromptItem[]; file_keys: string[] }>('/ai/prompts?include_inactive=1'),
    enabled: canManage,
  });

  const usageQuery = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => apiRequest<{ items: UsageItem[] }>('/ai/usage?per_page=20'),
    enabled: canManage,
  });

  const items = listQuery.data?.items ?? [];
  const selected = useMemo(
    () => items.find((p) => p.key === selectedKey) || null,
    [items, selectedKey],
  );

  const openEdit = (item: PromptItem) => {
    setSelectedKey(item.key);
    setDraft({ ...item });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft?.key) throw new Error('Chưa chọn prompt');
      return apiRequest<PromptItem>(`/ai/prompts/${encodeURIComponent(draft.key)}`, {
        method: 'PUT',
        body: {
          name: draft.name,
          description: draft.description,
          category: draft.category,
          system: draft.system,
          user: draft.user,
          output_format: draft.output_format || 'json',
          is_active: draft.is_active !== false,
          variables: draft.variables || [],
          entity_types: draft.entity_types || [],
        },
      });
    },
    onSuccess: async () => {
      toast.success('Đã lưu prompt (đánh dấu customized)');
      await qc.invalidateQueries({ queryKey: ['ai-prompts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sync = useMutation({
    mutationFn: (force: boolean) =>
      apiRequest<{
        created?: string[];
        updated?: string[];
        skipped_custom?: string[];
      }>('/ai/prompts/sync', {
        method: 'POST',
        body: { force },
      }),
    onSuccess: async (data, force) => {
      toast.success(
        force
          ? 'Đã force sync từ file seed'
          : `Sync xong — tạo ${data?.created?.length || 0}, cập nhật ${data?.updated?.length || 0}, bỏ qua customized ${data?.skipped_custom?.length || 0}`,
      );
      await qc.invalidateQueries({ queryKey: ['ai-prompts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canManage) {
    return (
      <div>
        <PageHeader eyebrow="Cài đặt" title="Prompt AI" description="Bạn không có quyền ai.manage." />
        <EmptyState title="Không có quyền" description="Chỉ owner / admin dự án mới quản lý prompt." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        title="Prompt AI hệ thống"
        description="Quản lý / cập nhật / theo dõi toàn bộ system prompt. File seed: resources/ai/prompts — xem docs/14-ai-system-prompts.md."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              loading={sync.isPending}
              onClick={() => sync.mutate(false)}
            >
              <RefreshCw size={16} />
              Sync từ file
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={sync.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Force sync sẽ ghi đè cả prompt đã customize trên DB bằng file seed. Tiếp tục?',
                  )
                ) {
                  sync.mutate(true);
                }
              }}
            >
              Force sync
            </Button>
          </div>
        }
      />

      <EntityList
        loading={listQuery.isLoading}
        empty={
          items.length === 0 ? (
            <EmptyState
              title="Chưa có prompt trên DB"
              description="Bấm Sync từ file hoặc chạy php artisan ai:sync-prompts."
            />
          ) : undefined
        }
      >
        {items.map((item) => (
          <EntityRow key={item.key}>
            <button
              type="button"
              onClick={() => openEdit(item)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
              }}
            >
              <EntityMain
                title={`${item.key} — ${item.name}`}
                facts={
                  <>
                    <span>{item.category || 'general'}</span>
                    <span> · v{item.version ?? 1}</span>
                    <span> · {item.source || 'db'}</span>
                    {item.is_customized ? <span> · customized</span> : null}
                    {item.is_active === false ? <span> · inactive</span> : null}
                  </>
                }
              />
            </button>
          </EntityRow>
        ))}
      </EntityList>

      {draft && selected ? (
        <div className="ai-prompt-editor" style={{ marginTop: '1.25rem' }}>
          <FormSection
            title={`Sửa «${draft.key}»`}
            description="Biến template dạng {{name}}. System + user là nội dung dài — soạn full width bên dưới."
          >
            <FormCluster title="Thông tin ngắn">
              <Input
                label="Tên"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                label="Category"
                value={draft.category || ''}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <Switch
                  label="Active"
                  checked={draft.is_active !== false}
                  onChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
            </FormCluster>

            <FormCluster title="Nội dung dài" cols={1}>
              <Textarea
                label="Mô tả"
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={4}
              />
              <Textarea
                className="ai-prompt-editor__code"
                label="System prompt"
                value={draft.system}
                onChange={(e) => setDraft({ ...draft, system: e.target.value })}
                rows={18}
              />
              <Textarea
                className="ai-prompt-editor__code"
                label="User template"
                value={draft.user}
                onChange={(e) => setDraft({ ...draft, user: e.target.value })}
                rows={12}
              />
            </FormCluster>

            <div className="ai-prompt-editor__actions">
              <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>
                Lưu prompt
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedKey(null);
                  setDraft(null);
                }}
              >
                Đóng
              </Button>
            </div>
          </FormSection>
        </div>
      ) : null}

      <div style={{ marginTop: '1.5rem' }}>
        <PageHeader
          eyebrow="Theo dõi"
          title="Usage gần đây"
          description="20 lần gọi AI mới nhất (mọi feature)."
        />
        <EntityList
          loading={usageQuery.isLoading}
          empty={
            (usageQuery.data?.items?.length ?? 0) === 0 ? (
              <EmptyState title="Chưa có usage" description="Chạy AI dịch hoặc AI chương trình trước." />
            ) : undefined
          }
        >
          {(usageQuery.data?.items ?? []).map((log) => (
            <EntityRow key={log.id}>
              <EntityMain
                title={`${log.success ? 'OK' : 'FAIL'} · ${log.prompt_key}`}
                facts={
                  <>
                    <span>{log.feature || '—'}</span>
                    <span> · {log.entity_type || '—'}</span>
                    <span> · {[log.provider, log.model].filter(Boolean).join(' / ') || '—'}</span>
                    {log.latency_ms ? <span> · {(log.latency_ms / 1000).toFixed(1)}s</span> : null}
                    {log.created_at ? <span> · {log.created_at}</span> : null}
                    {!log.success && log.error_message ? (
                      <span> · {log.error_message.slice(0, 120)}</span>
                    ) : null}
                  </>
                }
              />
            </EntityRow>
          ))}
        </EntityList>
      </div>
    </div>
  );
}
