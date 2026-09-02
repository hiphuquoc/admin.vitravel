'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import toast from '@/lib/toast';
import { projectsApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import {
  beginFormHydration,
  lockFormHydration,
  shouldHydrateScopedQuery,
  useResetFormOnProjectChange,
} from '@/hooks/useFormHydration';
import { createScopedQueryFn, useScopedQueryKey } from '@/hooks/useScopedQueryKey';
import {
  assertProjectResponse,
  useActiveProjectCode,
  useProjectMutationScope,
} from '@/hooks/useProjectScope';
import { Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormSection } from '@/components/ui/FormSection';

const AI_BRIEF_MAX = 5000;

export default function ProjectAiSettingsPage() {
  const { can, projects } = useAuth();
  const activeProjectCode = useActiveProjectCode();
  const { withProject } = useProjectMutationScope();
  const canEdit = can('settings.update');
  const qc = useQueryClient();
  const currentProject = projects.find((p) => p.code === activeProjectCode) ?? null;
  const [aiBrief, setAiBrief] = useState('');
  const hydrateKeyRef = useRef<string | null>(null);

  const settingsQueryKey = useScopedQueryKey('project-settings');
  const queryMatchesProject = shouldHydrateScopedQuery(settingsQueryKey, activeProjectCode);

  const query = useQuery({
    queryKey: settingsQueryKey,
    queryFn: createScopedQueryFn(() => projectsApi.settings()),
    enabled: !!activeProjectCode,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const resetForm = useCallback(() => {
    setAiBrief('');
  }, []);
  useResetFormOnProjectChange(hydrateKeyRef, resetForm);

  useEffect(() => {
    if (!query.data || !queryMatchesProject) return;
    if (!beginFormHydration(hydrateKeyRef, 'project-settings', activeProjectCode)) return;
    if (!assertProjectResponse(activeProjectCode, query.data)) return;
    setAiBrief(query.data.ai_brief || '');
  }, [query.data, activeProjectCode, queryMatchesProject, settingsQueryKey]);

  const save = useMutation({
    mutationFn: () =>
      withProject((projectCode) =>
        projectsApi.updateSettings({ ai_brief: aiBrief.trim() }, projectCode),
      ),
    onMutate: () => ({ projectCode: activeProjectCode }),
    onSuccess: async (data, _vars, context) => {
      const savedFor = context?.projectCode ?? activeProjectCode;
      if (!assertProjectResponse(savedFor, data)) {
        toast.error(
          `Phản hồi không khớp dự án (API: ${data.code}, đang chọn: ${savedFor}). Refresh trang.`,
        );
        return;
      }
      toast.success('Đã lưu bối cảnh AI dự án');
      if (savedFor === activeProjectCode) {
        setAiBrief(data.ai_brief || '');
      }
      lockFormHydration(hydrateKeyRef, 'project-settings', savedFor);
      const cacheKey = [savedFor ?? '_', 'project-settings'];
      qc.setQueryData(cacheKey, data);
      await qc.invalidateQueries({ queryKey: cacheKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Không có quyền sửa cài đặt dự án');
      return;
    }
    if (!activeProjectCode) {
      toast.error('Chưa chọn dự án');
      return;
    }
    save.mutate();
  };

  const chars = aiBrief.length;
  const responseMatchesProject =
    !query.data || assertProjectResponse(activeProjectCode, query.data);
  const formLoading =
    !!activeProjectCode && (query.isLoading || (query.isFetching && !responseMatchesProject));
  const formReady =
    !!activeProjectCode && responseMatchesProject && !query.isLoading && query.data != null;

  return (
    <div>
      <PageHeader
        eyebrow="Cài đặt"
        title="Bối cảnh AI dự án"
        description={
          currentProject
            ? `Dự án «${currentProject.name}» (${currentProject.code}) — mô tả ngắn giúp AI viết SEO/nội dung chính xác hơn.`
            : 'Chọn dự án ở header để cấu hình bối cảnh AI.'
        }
      />

      <form onSubmit={onSubmit} className="ui-form-layout">
        <div className="ui-form-layout__main ui-form-stack">
          <FormSection
            icon={Sparkles}
            title="Mô tả ngắn dự án"
            description="AI đọc khi chạy luồng thông tin trang + SEO (tour, du thuyền, lưu trú, listing…). Nên gồm: đối tượng khách, phạm vi địa lý, USP, tone thương hiệu, sản phẩm chủ lực."
          >
            {formLoading ? (
              <p className="body-text" style={{ opacity: 0.75 }}>
                Đang tải bối cảnh AI cho dự án «{currentProject?.name ?? activeProjectCode}»…
              </p>
            ) : null}
            <Textarea
              label="Bối cảnh AI"
              hint={`Tối đa ${AI_BRIEF_MAX} ký tự. Để trống nếu muốn AI chỉ dựa vào brand + loại trang.`}
              rows={14}
              value={aiBrief}
              disabled={!canEdit || !currentProject || !formReady || save.isPending}
              onChange={(e) => {
                setAiBrief(e.target.value.slice(0, AI_BRIEF_MAX));
              }}
            />
            <p className="body-text" style={{ opacity: 0.75, marginTop: '-0.25rem' }}>
              {chars.toLocaleString('vi-VN')} / {AI_BRIEF_MAX.toLocaleString('vi-VN')} ký tự
            </p>
            {!canEdit ? (
              <p className="body-text" style={{ color: 'var(--admin-warning)' }}>
                Thiếu quyền <code>settings.update</code> — chỉ xem.
              </p>
            ) : null}
          </FormSection>

          <FormFooter loading={save.isPending} cancelHref="/settings/site/" />
        </div>
      </form>
    </div>
  );
}
