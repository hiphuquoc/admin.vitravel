import {
  Anchor,
  Briefcase,
  Building2,
  Compass,
  FolderKanban,
  FolderTree,
  Globe2,
  Image,
  Languages,
  LayoutDashboard,
  Mail,
  Map,
  MessageSquare,
  Newspaper,
  Plane,
  Ship,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrainFront,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  /** Tiêu đề đầy đủ cho breadcrumb / trang (menu vẫn dùng label ngắn). */
  pageTitle?: string;
  href: string;
  icon: LucideIcon;
  match?: string;
  /** Query bắt buộc để coi là active (vd. cluster=train). */
  matchQuery?: Record<string, string>;
  soon?: boolean;
  /**
   * Hành động tức thì trong sidebar (không điều hướng).
   * VD: clear-html-cache → gọi API + toast, ở lại trang hiện tại.
   */
  action?: 'clear-html-cache';
};

export type NavGroup = {
  key: string;
  title: string;
  items: NavItem[];
};

/** Cụm dịch vụ — khớp `config/services_catalog.php` + seed dự án (train ↔ ferry). */
export const SERVICE_CLUSTERS = [
  {
    key: 'train',
    title: 'Tàu',
    label: 'Vé tàu hỏa',
    hubKey: 'trains_hub',
    icon: TrainFront,
  },
  {
    key: 'ferry',
    title: 'Tàu / Xe',
    label: 'Vé tàu cao tốc & xe khách',
    hubKey: 'ferries_hub',
    icon: Ship,
  },
  {
    key: 'flight',
    title: 'Máy bay',
    label: 'Vé máy bay',
    hubKey: 'flights_hub',
    icon: Plane,
  },
  {
    key: 'stay',
    title: 'Lưu trú',
    label: 'Khách sạn & Resort',
    hubKey: 'stays_hub',
    icon: Building2,
  },
  {
    key: 'experience',
    title: 'Vui chơi',
    label: 'Vé vui chơi & trải nghiệm',
    hubKey: 'experiences_hub',
    icon: Sparkles,
  },
  {
    key: 'other',
    title: 'Dịch vụ khác',
    label: 'Dịch vụ khác',
    hubKey: 'extras_hub',
    icon: Briefcase,
  },
] as const;

/** Hub SEO dùng trong `/settings/hubs/[hubKey]/` (static export). */
export const LISTING_HUB_KEYS = [
  'tours_hub',
  'cruises_hub',
  'trains_hub',
  'ferries_hub',
  'flights_hub',
  'stays_hub',
  'experiences_hub',
  'extras_hub',
  'guide_hub',
] as const;

export type ServiceClusterKey = (typeof SERVICE_CLUSTERS)[number]['key'];

export type ProjectServiceCluster = {
  code: string;
  nav_label?: string;
  label?: string;
  icon?: string;
  hub_key?: string | null;
  sort?: number;
};

/** Nhãn dài (vé / sản phẩm) — form & mô tả. */
export function serviceClusterLabel(key: string | null | undefined): string {
  return SERVICE_CLUSTERS.find((c) => c.key === key)?.label || key || 'Dịch vụ';
}

/** Tên ngắn group — dùng cho menu: Danh mục / Chi tiết / Hub [loại]. */
export function serviceClusterTitle(key: string | null | undefined): string {
  return SERVICE_CLUSTERS.find((c) => c.key === key)?.title || key || 'Dịch vụ';
}

/** Cụm dịch vụ active theo seed dự án (fallback: toàn bộ catalog trừ alias đối lập). */
export function activeServiceClusters(
  projectClusters?: ProjectServiceCluster[] | null,
): (typeof SERVICE_CLUSTERS)[number][] {
  const codes = (projectClusters || [])
    .map((c) => c.code)
    .filter((code): code is string => typeof code === 'string' && code !== '');

  if (codes.length === 0) {
    return SERVICE_CLUSTERS.filter((c) => c.key !== 'ferry') as unknown as (typeof SERVICE_CLUSTERS)[number][];
  }

  const set = new Set(codes);
  return SERVICE_CLUSTERS.filter((c) => set.has(c.key)) as unknown as (typeof SERVICE_CLUSTERS)[number][];
}

/** Lọc nhóm menu dịch vụ theo cụm của dự án hiện tại. */
export function filterNavGroupsByServiceClusters(
  groups: NavGroup[],
  projectClusters?: ProjectServiceCluster[] | null,
): NavGroup[] {
  const active = new Set(activeServiceClusters(projectClusters).map((c) => c.key));
  return groups
    .map((group) => {
      if (!group.key.startsWith('svc-')) return group;
      const code = group.key.slice(4);
      if (!active.has(code as ServiceClusterKey)) return null;

      const seed = (projectClusters || []).find((c) => c.code === code);
      if (!seed) return group;

      const title = seed.nav_label || seed.label || group.title;
      return {
        ...group,
        title,
        items: group.items.map((item) => {
          if (item.label.startsWith('Chi tiết ')) {
            return { ...item, label: `Chi tiết ${title}` };
          }
          if (item.label.startsWith('Danh mục ')) {
            return { ...item, label: `Danh mục ${title}` };
          }
          if (item.label.startsWith('Hub ')) {
            return { ...item, label: `Hub ${title}` };
          }
          return item;
        }),
      };
    })
    .filter(Boolean) as NavGroup[];
}

/** Alias train↔ferry khi URL cũ không khớp seed dự án. */
export function resolveProjectServiceCluster(
  requested: string | null | undefined,
  projectClusters?: ProjectServiceCluster[] | null,
): string {
  const codes = (projectClusters || []).map((c) => c.code).filter(Boolean);
  const req = (requested || '').trim();
  if (req && codes.includes(req)) return req;
  if (req === 'train' && codes.includes('ferry')) return 'ferry';
  if (req === 'ferry' && codes.includes('train')) return 'train';
  if (codes.length > 0) return codes[0];
  return req || 'train';
}

/** Nhãn menu chuẩn cho listing hub theo hubKey. */
export function listingHubNavLabel(hubKey: string | null | undefined): string {
  const map: Record<string, string> = {
    tours_hub: 'Hub Tour',
    cruises_hub: 'Hub Du thuyền',
    guide_hub: 'Hub Blog',
  };
  for (const cluster of SERVICE_CLUSTERS) {
    map[cluster.hubKey] = `Hub ${cluster.title}`;
  }
  if (!hubKey) return 'Hub';
  return map[hubKey] || `Hub ${hubKey.replace(/_hub$/, '')}`;
}

/** Grouped admin navigation — Tour / Du thuyền / từng cụm DV tách riêng. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    title: 'Tổng quan',
    items: [{ label: 'Bảng điều khiển', href: '/', icon: LayoutDashboard }],
  },
  {
    key: 'tour',
    title: 'Tour',
    items: [
      { label: 'Chi tiết Tour', href: '/tours/packages/', icon: Map, match: '/tours/packages' },
      {
        label: 'Danh mục Tour',
        href: '/tours/destinations/',
        icon: Globe2,
        match: '/tours/destinations',
      },
      {
        label: 'Chủ đề Tour',
        href: '/tours/categories/',
        icon: FolderTree,
        match: '/tours/categories',
      },
      {
        label: 'Hub Tour',
        href: '/settings/hubs/tours_hub/',
        icon: Globe2,
        match: '/settings/hubs/tours_hub',
      },
    ],
  },
  {
    key: 'cruise',
    title: 'Du thuyền',
    items: [
      {
        label: 'Chi tiết Du thuyền',
        href: '/cruises/packages/',
        icon: Ship,
        match: '/cruises/packages',
      },
      {
        label: 'Danh mục Du thuyền',
        href: '/cruises/types/',
        icon: Anchor,
        match: '/cruises/types',
      },
      {
        label: 'Hub Du thuyền',
        href: '/settings/hubs/cruises_hub/',
        icon: Ship,
        match: '/settings/hubs/cruises_hub',
      },
    ],
  },
  ...SERVICE_CLUSTERS.map((cluster) => ({
    key: `svc-${cluster.key}`,
    title: cluster.title,
    items: [
      {
        label: `Chi tiết ${cluster.title}`,
        href: `/services/products/?cluster=${cluster.key}`,
        icon: cluster.icon,
        match: '/services/products',
        matchQuery: { cluster: cluster.key },
      },
      {
        label: `Danh mục ${cluster.title}`,
        href: `/services/categories/?cluster=${cluster.key}`,
        icon: FolderKanban,
        match: '/services/categories',
        matchQuery: { cluster: cluster.key },
      },
      {
        label: `Hub ${cluster.title}`,
        href: `/settings/hubs/${cluster.hubKey}/`,
        icon: Globe2,
        match: `/settings/hubs/${cluster.hubKey}`,
      },
    ] as NavItem[],
  })),
  {
    key: 'content',
    title: 'Nội dung',
    items: [
      {
        label: 'Slider trang chủ',
        href: '/content/slides/',
        icon: SlidersHorizontal,
        match: '/content/slides',
      },
      {
        label: 'Nội dung trang chủ',
        href: '/content/home/',
        icon: LayoutDashboard,
        match: '/content/home',
      },
      {
        label: 'Chi tiết Blog',
        href: '/content/articles/',
        icon: Newspaper,
        match: '/content/articles',
      },
      {
        label: 'Danh mục Blog',
        href: '/content/blog-categories/',
        icon: FolderTree,
        match: '/content/blog-categories',
      },
      {
        label: 'Hub Blog',
        href: '/settings/hubs/guide_hub/',
        icon: Newspaper,
        match: '/settings/hubs/guide_hub',
      },
    ],
  },
  {
    key: 'brand',
    title: 'Thương hiệu',
    items: [
      { label: 'Đội ngũ', href: '/brand/team/', icon: Users, match: '/brand/team' },
      { label: 'Văn phòng', href: '/brand/offices/', icon: Building2, match: '/brand/offices' },
      { label: 'Công ty', href: '/brand/company/', icon: Building2, match: '/brand/company' },
      { label: 'Giá trị cốt lõi', href: '/brand/values/', icon: Star, match: '/brand/values' },
      { label: 'Lý do chọn', href: '/brand/reasons/', icon: Star, match: '/brand/reasons' },
      { label: 'Đại diện NN', pageTitle: 'Đại diện nước ngoài', href: '/brand/references/', icon: Users, match: '/brand/references' },
      { label: 'Cảm nhận KH', pageTitle: 'Cảm nhận khách hàng', href: '/brand/reviews/', icon: MessageSquare, match: '/brand/reviews' },
      {
        label: 'Nền tảng ĐG',
        pageTitle: 'Nền tảng đánh giá',
        href: '/brand/platforms/',
        icon: Star,
        match: '/brand/platforms',
      },
      { label: 'Thư viện ảnh', href: '/brand/gallery/', icon: Image, match: '/brand/gallery' },
      { label: 'Video', href: '/brand/videos/', icon: Video, match: '/brand/videos' },
    ],
  },
  {
    key: 'leads',
    title: 'Khách hàng tiềm năng',
    items: [
      { label: 'Yêu cầu nhanh', href: '/leads/quick/', icon: Mail, match: '/leads/quick' },
      { label: 'Tour riêng', href: '/leads/custom/', icon: Map, match: '/leads/custom' },
      { label: 'Liên hệ', href: '/leads/contacts/', icon: Mail, match: '/leads/contacts' },
      { label: 'Bình luận', href: '/leads/comments/', icon: MessageSquare, match: '/leads/comments' },
    ],
  },
  {
    key: 'settings',
    title: 'Cài đặt',
    items: [
      {
        label: 'Thông tin dự án',
        href: '/settings/site/',
        icon: Building2,
        match: '/settings/site',
      },
      {
        label: 'Người dùng',
        href: '/settings/users/',
        icon: Users,
        match: '/settings/users',
      },
      {
        label: 'Ngôn ngữ',
        href: '/settings/languages/',
        icon: Languages,
        match: '/settings/languages',
      },
      { label: 'Xóa HTML cache', href: '#', action: 'clear-html-cache', icon: Trash2 },
      {
        label: 'Phong cách du lịch',
        href: '/tours/themes/',
        icon: Compass,
        match: '/tours/themes',
      },
      { label: 'Thư viện Media', href: '/settings/media/', icon: Image, match: '/settings/media' },
    ],
  },
];

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '') || '/';
}

export function isNavActive(
  pathname: string,
  item: NavItem,
  searchParams?: URLSearchParams | null,
): boolean {
  if (item.action) return false;
  const path = normalizePath(pathname);
  if (item.href === '/' || item.href === '') return path === '/';
  const base = normalizePath(item.match || item.href.split('?')[0] || item.href);
  if (!(path === base || path.startsWith(`${base}/`))) return false;

  if (item.matchQuery) {
    if (!searchParams) return false;
    return Object.entries(item.matchQuery).every(
      ([key, value]) => searchParams.get(key) === value,
    );
  }

  return true;
}
