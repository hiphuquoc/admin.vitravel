'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { galleryAlbumsApi } from '@/lib/services';

export default function GalleryFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/gallery/"
      queryKey="gallery-albums"
      titleNew="Thêm album"
      titleEdit="Sửa album"
      empty={{
        title: '',
        description: '',
        customer_name: '',
        trip_date: '',
        sort: '0',
        status: 'draft',
        country_id: '',
      }}
      fields={[
        { key: 'title', label: 'Tiêu đề' },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
        { key: 'customer_name', label: 'Khách hàng' },
        { key: 'trip_date', label: 'Ngày chuyến đi' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
      ]}
      getFn={(id, locale) => galleryAlbumsApi.get(id, locale)}
      createFn={(b) => galleryAlbumsApi.create(b)}
      updateFn={(id, b) => galleryAlbumsApi.update(id, b)}
      mapDetail={(d) => ({
        title: d.title || '',
        description: d.description || '',
        customer_name: d.customer_name || '',
        trip_date: d.trip_date || '',
        sort: String(d.sort || 0),
        status: d.status || 'draft',
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
