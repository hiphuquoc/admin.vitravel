import type { MediaFolder } from '@/lib/types';

export const MEDIA_FOLDER_LABELS: Record<string, string> = {
  packages: 'Tour / Du thuyền',
  tour_categories: 'Danh mục tour',
  cruise_types: 'Loại du thuyền',
  countries: 'Điểm đến',
  service_categories: 'Danh mục DV',
  services: 'Dịch vụ',
  home_slider: 'Slider trang chủ',
  home_sections: 'Khối trang chủ',
  articles: 'Blog',
  team: 'Đội ngũ',
  reviews: 'Cảm nhận KH',
  videos: 'Ảnh video',
  video_files: 'File video',
  company: 'Công ty',
  default: 'Chung',
};

export function mediaFolderLabel(key: string | null | undefined): string {
  if (!key) return 'Chung';
  return MEDIA_FOLDER_LABELS[key] || key;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatMediaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function isMediaFolder(value: string): value is MediaFolder {
  return value in MEDIA_FOLDER_LABELS;
}
