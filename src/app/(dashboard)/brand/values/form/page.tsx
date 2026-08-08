'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { companyValuesApi } from '@/lib/services';

export default function ValueFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/values/"
      queryKey="company-values"
      titleNew="Thêm giá trị"
      titleEdit="Sửa giá trị"
      empty={{ name: '', description: '', sort: '0', is_active: true }}
      fields={[
        { key: 'name', label: 'Tên' },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
        { key: 'is_active', label: 'Đang hoạt động', type: 'switch' },
      ]}
      getFn={(id, locale) => companyValuesApi.get(id, locale)}
      createFn={(b) => companyValuesApi.create(b)}
      updateFn={(id, b) => companyValuesApi.update(id, b)}
      mapDetail={(d) => ({
        name: d.name || '',
        description: d.description || '',
        sort: String(d.sort || 0),
        is_active: !!d.is_active,
      })}
      mapPayload={(form, locale) => ({ ...form, sort: Number(form.sort) || 0, locale })}
      languagesFrom={(d) => (d?.languages as never) || []}
    />
  );
}
