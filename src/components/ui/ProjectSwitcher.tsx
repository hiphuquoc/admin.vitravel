'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth-context';
import toast from '@/lib/toast';

export function ProjectSwitcher() {
  const { projects, projectCode, setActiveProject } = useAuth();
  const qc = useQueryClient();

  if (!projects.length) {
    return (
      <div className="project-switch project-switch--empty" title="Chưa có dự án">
        <span className="project-switch__label">Chưa có dự án</span>
      </div>
    );
  }

  const current = projects.find((p) => p.code === projectCode) ?? projects[0];
  const options = projects.map((p) => ({
    value: p.code,
    label: `${p.name} (${p.code})`,
  }));

  return (
    <div className="project-switch" aria-label="Chọn dự án">
      <Select
        options={options}
        value={current?.code ?? ''}
        searchable={projects.length > 5}
        placeholder="Chọn dự án…"
        className="project-switch__select-field"
        panelMinWidth={288}
        panelAlign="end"
        preferredMaxHeight={320}
        onChange={(code) => {
          if (!code || code === projectCode) return;
          setActiveProject(code);
          void qc.invalidateQueries();
          const name = projects.find((p) => p.code === code)?.name ?? code;
          toast.success(`Đang xem: ${name}`);
        }}
      />
    </div>
  );
}
