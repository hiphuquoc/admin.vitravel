'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import toast from '@/lib/toast';
import { projectsApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import { Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormFooter } from '@/components/ui/FormFooter';
import { FormSection } from '@/components/ui/FormSection';

const AI_BRIEF_MAX = 5000;

export default function ProjectAiSettingsPage() {
  const { can, projects, projectCode } = useAuth();
  const canEdit = can('settings.update');
  const qc = useQueryClient();
  const currentProject = projects.find((p) => p.code === projectCode) ?? null;
  const [aiBrief, setAiBrief] = useState('');
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ['project-settings', currentProject?.code],
    queryFn: () => projectsApi.settings(),
    enabled: !!currentProject?.code,
  });

  useEffect(() => {
    if (!query.data || dirty) return;
    setAiBrief(query.data.ai_brief || '');
  }, [query.data, dirty]);

  const save = useMutation({
    mutationFn: () => projectsApi.updateSettings({ ai_brief: aiBrief.trim() }),
    onSuccess: (data) => {
      toast.success('Đã lưu bối cảnh AI dự án');
      setAiBrief(data.ai_brief || '');
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['project-settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Không có quyền sửa cài đặt dự án');
      return;
    }
    save.mutate();
  };

  const chars = aiBrief.length;

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
            <Textarea
              label="Bối cảnh AI"
              hint={`Tối đa ${AI_BRIEF_MAX} ký tự. Để trống nếu muốn AI chỉ dựa vào brand + loại trang.`}
              rows={14}
              value={aiBrief}
              disabled={!canEdit || !currentProject}
              onChange={(e) => {
                setDirty(true);
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
