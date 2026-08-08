'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { reasonsApi } from '@/lib/services';

export default function ReasonFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/reasons/"
      queryKey="reasons"
      titleNew="Thêm lý do"
      titleEdit="Sửa lý do"
      empty={{ title: '', description: '', sort: '0', is_active: true }}
      fields={[
        { key: 'title', label: 'Tiêu đề' },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
        { key: 'is_active', label: 'Đang hoạt động', type: 'switch' },
      ]}
      getFn={(id, locale) => reasonsApi.get(id, locale)}
      createFn={(b) => reasonsApi.create(b)}
      updateFn={(id, b) => reasonsApi.update(id, b)}
      mapDetail={(d) => ({
        title: d.title || '',
        description: d.description || '',
        sort: String(d.sort || 0),
        is_active: !!d.is_active,
      })}
      mapPayload={(form, locale) => ({ ...form, sort: Number(form.sort) || 0, locale })}
    />
  );
}
