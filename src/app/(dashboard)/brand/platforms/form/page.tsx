'use client';

import { ResourceFormPage } from '@/components/admin/ResourceFormPage';
import { reviewPlatformsApi } from '@/lib/services';

export default function PlatformFormPage() {
  return (
    <ResourceFormPage
      eyebrow="Thương hiệu"
      listHref="/brand/platforms/"
      queryKey="review-platforms"
      titleNew="Thêm nền tảng đánh giá"
      titleEdit="Sửa nền tảng đánh giá"
      withLocale={false}
      empty={{
        code: '',
        name: '',
        rating: '',
        review_count: '',
        url: '',
        quote: '',
        link_label: '',
        sort: '0',
        is_active: true,
        show_on_home: false,
      }}
      fields={[
        { key: 'code', label: 'Mã' },
        { key: 'name', label: 'Tên' },
        { key: 'rating', label: 'Điểm đánh giá', type: 'number' },
        { key: 'review_count', label: 'Số đánh giá', type: 'number' },
        { key: 'url', label: 'Liên kết' },
        { key: 'quote', label: 'Trích dẫn', type: 'textarea' },
        { key: 'link_label', label: 'Nhãn liên kết' },
        { key: 'sort', label: 'Thứ tự', type: 'number' },
        { key: 'is_active', label: 'Đang hoạt động', type: 'switch' },
        { key: 'show_on_home', label: 'Hiện trang chủ', type: 'switch' },
      ]}
      getFn={(id) => reviewPlatformsApi.get(id)}
      createFn={(b) => reviewPlatformsApi.create(b)}
      updateFn={(id, b) => reviewPlatformsApi.update(id, b)}
      mapDetail={(d) => ({
        code: d.code || '',
        name: d.name || '',
        rating: d.rating != null ? String(d.rating) : '',
        review_count: d.review_count != null ? String(d.review_count) : '',
        url: d.url || '',
        quote: d.quote || '',
        link_label: d.link_label || '',
        sort: String(d.sort || 0),
        is_active: !!d.is_active,
        show_on_home: !!d.show_on_home,
      })}
      mapPayload={(form) => ({
        ...form,
        rating: form.rating ? Number(form.rating) : null,
        review_count: form.review_count ? Number(form.review_count) : null,
        sort: Number(form.sort) || 0,
      })}
    />
  );
}
