'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { officesApi } from '@/lib/services';

export default function OfficeFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/offices/"
      queryKey="offices"
      titleNew="Thêm văn phòng"
      titleEdit="Sửa văn phòng"
      empty={{
        city_label: '',
        address_line: '',
        phone: '',
        whatsapp: '',
        email: '',
        map_embed_url: '',
        sort: '0',
        is_active: true,
        country_id: '',
      }}
      fields={[
        { key: 'city_label', label: 'Thành phố' },
        { key: 'address_line', label: 'Địa chỉ', type: 'textarea' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'email', label: 'Email' },
        { key: 'map_embed_url', label: 'URL nhúng bản đồ' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
        { key: 'is_active', label: 'Đang hoạt động', type: 'switch' },
      ]}
      getFn={(id, locale) => officesApi.get(id, locale)}
      createFn={(b) => officesApi.create(b)}
      updateFn={(id, b) => officesApi.update(id, b)}
      mapDetail={(d) => ({
        city_label: d.city_label || '',
        address_line: d.address_line || '',
        phone: d.phone || '',
        whatsapp: d.whatsapp || '',
        email: d.email || '',
        map_embed_url: d.map_embed_url || '',
        sort: String(d.sort || 0),
        is_active: !!d.is_active,
        country_id: d.country_id ? String(d.country_id) : '',
      })}
      mapPayload={(form, locale) => ({
        ...form,
        sort: Number(form.sort) || 0,
        country_id: form.country_id ? Number(form.country_id) : null,
        locale,
      })}
    />
  );
}
