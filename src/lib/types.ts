export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  success: true;
  message: string;
  data: T;
};

export type Paginated<T> = {
  items: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_super_admin?: boolean;
  role_label?: string;
  is_active?: boolean;
  permissions?: string[];
  project_role?: string | null;
  projects?: AdminProject[];
  current_project?: AdminProject | null;
};

export type AdminProject = {
  id: number;
  code: string;
  name: string;
  primary_domain?: string | null;
  seed_profile?: string | null;
  is_active?: boolean;
  media_prefix?: string | null;
  domains?: { domain: string; is_primary: boolean }[];
  role?: string;
  permissions?: string[];
};

export type UserProjectAssignment = {
  project_id?: number;
  id: number;
  code: string;
  name: string;
  role: string;
  permissions?: {
    grant?: string[];
    deny?: string[];
  };
  effective_permissions?: string[];
};

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  role_label?: string;
  is_active: boolean;
  is_super_admin?: boolean;
  projects_count?: number;
  projects?: { id: number; code: string; name: string; role?: string }[];
  created_at?: string | null;
};

export type UserDetail = Omit<UserListItem, 'projects'> & {
  projects: UserProjectAssignment[];
};

export type PermissionGroup = {
  module: string;
  label: string;
  items: { key: string; label: string }[];
};

export type UsersMeta = {
  system_roles: ValueLabel[];
  project_roles: ValueLabel[];
  permission_groups: PermissionGroup[];
  projects: { id: number; code: string; name: string }[];
  can_assign_super_admin: boolean;
};

export type ValueLabel = { value: string; label: string };

export type MediaImage = {
  id: number;
  url: string | null;
  url_thumb?: string | null;
  url_lg?: string | null;
  url_full?: string | null;
  filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  credit?: string | null;
  path?: string | null;
  disk?: string | null;
  folder?: string | null;
  kind?: 'image' | 'video' | string;
  has_variants?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MediaFolder =
  | 'packages'
  | 'tour_categories'
  | 'cruise_types'
  | 'countries'
  | 'service_categories'
  | 'services'
  | 'home_slider'
  | 'home_sections'
  | 'articles'
  | 'team'
  | 'reviews'
  | 'videos'
  | 'video_files'
  | 'company'
  | 'default';

export type PackageListItem = {
  id: number;
  type: string;
  code: string | null;
  title: string | null;
  status: 'draft' | 'published' | 'archived' | string;
  duration_days: number;
  duration_nights: number;
  price_from: string | number | null;
  currency: string;
  is_featured: boolean;
  is_hot_deal: boolean;
  cruise_type?: string | null;
  cruise_type_name?: string | null;
  country: { id: number; name: string | null } | null;
  travel_styles: { id: number; name: string | null }[];
  cover?: MediaImage | null;
  seo?: { slug: string | null; slug_full: string | null };
  updated_at: string | null;
};

export type PackageItineraryDay = {
  id?: number | null;
  day_number: number;
  meals_included: string;
  transport_icons: string;
  title: string;
  content: string;
  overnight_at: string;
};

export type PackageFaq = {
  id?: number | null;
  question: string;
  answer: string;
};

export type PackageDetail = PackageListItem & {
  start_location: string | null;
  end_location: string | null;
  summary: string | null;
  highlights_intro: string | null;
  featured_quote_text: string | null;
  featured_quote_author: string | null;
  places_to_visit: string | null;
  highlight_bullets: string | null;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  sort: number;
  discount_badge: string | null;
  cruise_type: string | null;
  departure_port: string | null;
  boat_class: string | null;
  nights_on_board: number | null;
  country_id: number | null;
  country_ids: number[];
  travel_style_ids: number[];
  category_ids: number[];
  itinerary: PackageItineraryDay[];
  faqs: PackageFaq[];
  translated_locales?: string[];
  cover: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    parent_id?: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type CruiseTypeOption = {
  id: number;
  slug: string;
  name: string | null;
  is_active?: boolean;
};

export type CruiseType = {
  id: number;
  name: string | null;
  slug: string | null;
  sort: number;
  is_active: boolean;
  seo?: { slug: string | null; slug_full: string | null };
  cover?: MediaImage | null;
  banner?: MediaImage | null;
  updated_at: string | null;
};

export type CruiseTypeDetail = CruiseType & {
  translated_locales?: string[];
  cover: MediaImage | null;
  banner: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    parent_id?: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type TourCategory = {
  id: number;
  type: string;
  type_label: string;
  name: string | null;
  slug: string | null;
  seo?: { slug: string | null; slug_full: string | null };
  sort: number;
  is_active: boolean;
  country: { id: number; name: string | null } | null;
  cover?: MediaImage | null;
  updated_at: string | null;
};

export type TourCategoryDetail = TourCategory & {
  country_id: number | null;
  description: string | null;
  seo_intro: string | null;
  translated_locales?: string[];
  cover: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    parent_id?: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type TravelStyle = {
  id: number;
  code: string;
  name: string | null;
  slug: string | null;
  sort: number;
  is_active: boolean;
  packages_count: number;
  updated_at: string | null;
};

export type TravelStyleDetail = TravelStyle & {
  description: string | null;
  translated_locales?: string[];
};

export type Country = {
  id: number;
  code: string;
  name: string | null;
  slug: string | null;
  sort: number;
  is_active: boolean;
  show_in_menu: boolean;
  home_grid_size: string | null;
  seo?: { slug: string | null; slug_full: string | null };
  banner?: MediaImage | null;
  updated_at: string | null;
};

export type CountryDetail = Country & {
  show_in_customize_form: boolean;
  tagline: string | null;
  intro_text: string | null;
  long_form_content: string | null;
  translated_locales?: string[];
  banner: MediaImage | null;
  listing_banner: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    keywords: string | null;
    parent_id: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type ServiceCategory = {
  id: number;
  cluster: string;
  cluster_label: string;
  name: string | null;
  slug: string | null;
  intro: string | null;
  sort: number;
  is_active: boolean;
  seo?: { slug: string | null; slug_full: string | null };
  banner?: MediaImage | null;
  updated_at: string | null;
};

export type ServiceCategoryDetail = ServiceCategory & {
  translated_locales?: string[];
  banner: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    keywords: string | null;
    parent_id: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type ServiceItem = {
  id: number;
  cluster: string;
  cluster_label: string;
  code: string | null;
  title: string | null;
  status: string;
  price_from: string | number | null;
  currency: string;
  sort: number;
  is_featured: boolean;
  is_hot_deal: boolean;
  category: { id: number; name: string | null } | null;
  country: { id: number; name: string | null } | null;
  seo?: { slug: string | null; slug_full: string | null };
  cover?: MediaImage | null;
  updated_at: string | null;
};

export type ServiceDetail = ServiceItem & {
  service_category_id: number | null;
  country_id: number | null;
  location_label: string | null;
  summary: string | null;
  content: string | null;
  featured_quote_text: string | null;
  featured_quote_author: string | null;
  highlights: string;
  inclusions: string;
  exclusions: string;
  notes: string;
  rating: number | null;
  review_count: number | null;
  star_rating: number | null;
  discount_badge: string | null;
  translated_locales?: string[];
  cover: MediaImage | null;
  seo: {
    slug: string | null;
    slug_full: string | null;
    title: string | null;
    description: string | null;
    keywords: string | null;
    parent_id: number | null;
    rating_aggregate_star: number | null;
    rating_aggregate_count: number | null;
  };
};

export type Option = { id: number; name: string | null; code?: string };
