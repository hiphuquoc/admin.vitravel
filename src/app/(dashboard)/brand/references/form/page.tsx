'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { referencePersonsApi } from '@/lib/services';

export default function ReferenceFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/references/"
      queryKey="reference-persons"
      titleNew="Thêm đại diện nước ngoài"
      titleEdit="Sửa đại diện nước ngoài"
      withLocale={false}
      empty={{
        name: '',
        email: '',
        phone: '',
        skype: '',
        sort: '0',
        is_active: true,
        country_id: '',
      }}
      fields={[
        { key: 'name', label: 'Họ tên' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'skype', label: 'Skype' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
        { key: 'is_active', label: 'Đang hoạt động', type: 'switch' },
      ]}
      getFn={(id) => referencePersonsApi.get(id)}
      createFn={(b) => referencePersonsApi.create(b)}
      updateFn={(id, b) => referencePersonsApi.update(id, b)}
      mapDetail={(d) => ({
        name: d.name || '',
        email: d.email || '',
        phone: d.phone || '',
        skype: d.skype || '',
        sort: String(d.sort || 0),
        is_active: !!d.is_active,
        country_id: d.country_id ? String(d.country_id) : '',
      })}
      mapPayload={(form) => ({
        ...form,
        sort: Number(form.sort) || 0,
        country_id: form.country_id ? Number(form.country_id) : null,
      })}
    />
  );
}
