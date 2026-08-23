import { ApiClientError, apiRequest, getApiBase, getProjectCode, getToken } from './api';
import type {
  AdminProject,
  AdminUser,
  UserDetail,
  UserListItem,
  UsersMeta,
  CruiseType,
  CruiseTypeDetail,
  CruiseTypeOption,
  Country,
  CountryDetail,
  MediaFolder,
  MediaImage,
  Option,
  PackageDetail,
  PackageListItem,
  Paginated,
  ServiceCategory,
  ServiceCategoryDetail,
  ServiceItem,
  ServiceDetail,
  PriceGuestType,
  TourCategory,
  TourCategoryDetail,
  TravelStyle,
  TravelStyleDetail,
  ValueLabel,
} from './types';
import type { LocaleOption } from './locale';
import type { StayRoomFormRow } from './aiEnrichFields';

export type PackageType = 'tour' | 'cruise';

export type AuthLoginResult = {
  token: string;
  token_type: string;
  expires_in_days?: number;
  user: AdminUser;
  projects: AdminProject[];
  current_project: AdminProject | null;
};

export const authApi = {
  login: (email: string, password: string, deviceName?: string) =>
    apiRequest<AuthLoginResult>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password, device_name: deviceName || 'ViTravel Admin' },
    }),
  me: () => apiRequest<AdminUser>('/auth/me'),
  updateProfile: (body: Record<string, unknown>) =>
    apiRequest<AdminUser>('/auth/me', { method: 'PUT', body }),
  logout: () => apiRequest<null>('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  meta: () => apiRequest<UsersMeta>('/users/meta'),
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<Paginated<UserListItem>>('/users', { query }),
  get: (id: number) => apiRequest<UserDetail>(`/users/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<UserDetail>('/users', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<UserDetail>(`/users/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/users/${id}`, { method: 'DELETE' }),
};

export const projectsApi = {
  list: () => apiRequest<{ projects: AdminProject[] }>('/projects'),
  get: (id: number) => apiRequest<AdminProject>(`/projects/${id}`),
};

export const metaApi = {
  languages: () =>
    apiRequest<{ default_code: string; items: LocaleOption[] }>('/meta/languages'),
};

function packagesApiFor(type: PackageType) {
  return {
    list: (query?: Record<string, string | number | boolean | undefined>) =>
      apiRequest<Paginated<PackageListItem>>('/packages', { query: { type, ...query } }),
    get: (id: number, locale = 'vi') =>
      apiRequest<PackageDetail>(`/packages/${id}`, { query: { locale } }),
    create: (body: Record<string, unknown>) =>
      apiRequest<PackageDetail>('/packages', { method: 'POST', body: { type, ...body } }),
    update: (id: number, body: Record<string, unknown>) =>
      apiRequest<PackageDetail>(`/packages/${id}`, { method: 'PUT', body: { type, ...body } }),
    remove: (id: number) => apiRequest<null>(`/packages/${id}`, { method: 'DELETE' }),
    meta: (locale = 'vi') =>
      apiRequest<{
        countries: Option[];
        travel_styles: Option[];
        cruise_types: CruiseTypeOption[];
        currencies: ValueLabel[];
        default_currency: string;
        statuses: ValueLabel[];
        discount_badges: ValueLabel[];
        languages: LocaleOption[];
        default_locale: string;
        seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
      }>('/packages/meta', { query: { locale, type } }),
  };
}

export const packagesApi = packagesApiFor('tour');
export const cruisePackagesApi = packagesApiFor('cruise');

export const categoriesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<
      Paginated<TourCategory> & { type_options: ValueLabel[] }
    >('/tour-categories', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<TourCategoryDetail>(`/tour-categories/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<TourCategoryDetail>('/tour-categories', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<TourCategoryDetail>(`/tour-categories/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/tour-categories/${id}`, { method: 'DELETE' }),
  meta: (locale = 'vi') =>
    apiRequest<{
      countries: Option[];
      type_options: ValueLabel[];
      languages: LocaleOption[];
      default_locale: string;
      seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
    }>('/tour-categories/meta', {
      query: { locale },
    }),
};

export const themesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<Paginated<TravelStyle>>('/travel-styles', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<TravelStyleDetail>(`/travel-styles/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<TravelStyleDetail>('/travel-styles', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<TravelStyleDetail>(`/travel-styles/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/travel-styles/${id}`, { method: 'DELETE' }),
};

export const cruiseTypesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<
      Paginated<CruiseType> & { languages?: LocaleOption[]; default_locale?: string }
    >('/cruise-types', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<CruiseTypeDetail>(`/cruise-types/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<CruiseTypeDetail>('/cruise-types', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<CruiseTypeDetail>(`/cruise-types/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/cruise-types/${id}`, { method: 'DELETE' }),
  meta: (locale = 'vi') =>
    apiRequest<{
      languages: LocaleOption[];
      default_locale: string;
      hub_seo_id: number;
      seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
    }>('/cruise-types/meta', { query: { locale } }),
};

export const countriesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<Paginated<Country>>('/countries', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<CountryDetail>(`/countries/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<CountryDetail>('/countries', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<CountryDetail>(`/countries/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/countries/${id}`, { method: 'DELETE' }),
  setActive: (id: number, is_active: boolean) =>
    apiRequest<{ id: number; is_active: boolean }>(`/countries/${id}/active`, {
      method: 'PATCH',
      body: { is_active },
    }),
  meta: (locale = 'vi') =>
    apiRequest<{
      languages: LocaleOption[];
      default_locale: string;
      hub_seo_id: number;
      seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
      home_grid_sizes: ValueLabel[];
    }>('/countries/meta', { query: { locale } }),
};

export const serviceCategoriesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<Paginated<ServiceCategory>>('/service-categories', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<ServiceCategoryDetail>(`/service-categories/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<ServiceCategoryDetail>('/service-categories', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<ServiceCategoryDetail>(`/service-categories/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/service-categories/${id}`, { method: 'DELETE' }),
  meta: (locale = 'vi', cluster?: string) =>
    apiRequest<{
      languages: LocaleOption[];
      default_locale: string;
      clusters: ValueLabel[];
      hub_seo_id: number | null;
      seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
    }>('/service-categories/meta', { query: { locale, cluster } }),
};

export const servicesApi = {
  list: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<Paginated<ServiceItem>>('/services', { query }),
  get: (id: number, locale = 'vi') =>
    apiRequest<ServiceDetail>(`/services/${id}`, { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<ServiceDetail>('/services', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<ServiceDetail>(`/services/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/services/${id}`, { method: 'DELETE' }),
  createOption: (serviceId: number, body: Record<string, unknown>) =>
    apiRequest<{ option: StayRoomFormRow }>(`/services/${serviceId}/options`, { method: 'POST', body }),
  updateOption: (serviceId: number, optionId: number, body: Record<string, unknown>) =>
    apiRequest<{ option: StayRoomFormRow }>(`/services/${serviceId}/options/${optionId}`, {
      method: 'PUT',
      body,
    }),
  duplicateOption: (serviceId: number, optionId: number, body?: Record<string, unknown>) =>
    apiRequest<{ option: StayRoomFormRow }>(`/services/${serviceId}/options/${optionId}/duplicate`, {
      method: 'POST',
      body,
    }),
  removeOption: (serviceId: number, optionId: number) =>
    apiRequest<null>(`/services/${serviceId}/options/${optionId}`, { method: 'DELETE' }),
  meta: (locale = 'vi', cluster?: string) =>
    apiRequest<{
      languages: LocaleOption[];
      default_locale: string;
      cluster: string;
      clusters: ValueLabel[];
      categories: Option[];
      countries: Option[];
      statuses: ValueLabel[];
      property_types: ValueLabel[];
      deal_labels?: ValueLabel[];
      hub_seo_id: number | null;
      seo_parents: { id: number; label: string; slug_full?: string; reference_id?: number | null }[];
    }>('/services/meta', { query: { locale, cluster } }),
};

export type StayCrawlJob = {
  id: number;
  list_url: string;
  canonical_url?: string | null;
  status: string;
  pages_crawled?: number;
  items_found?: number;
  items_count?: number | null;
  service_category_id?: number | null;
  error?: string | null;
  list?: {
    max_pages?: number;
    page_size?: number;
    pages_done?: number;
    offset?: number;
    urls_queued?: number;
    stopped_reason?: string | null;
    mode?: string | null;
  } | null;
  worker?: {
    running?: boolean;
    paused?: boolean;
    mode?: string | null;
    pid?: number | null;
    heartbeat_at?: string | null;
    stop_reason?: string | null;
    last_message?: string | null;
    message?: string | null;
    remaining?: number;
    log?: string | null;
  } | null;
  worker_alive?: boolean;
  worker_paused?: boolean;
  created_at?: string | null;
};

export type StayCrawlItem = {
  id: number;
  job_id?: number | null;
  source_url: string;
  canonical_url: string;
  status: string;
  http_status?: number | null;
  blocked_reason?: string | null;
  service_id?: number | null;
  error?: string | null;
  crawled_at?: string | null;
  ai_at?: string | null;
  imported_at?: string | null;
  has_extracted?: boolean;
  has_ai?: boolean;
  slug_full?: string | null;
  enrich?: {
    gallery?: string;
    rooms?: string;
    rooms_next?: number;
    rooms_total?: number | null;
    gallery_count?: number;
    rooms_ok?: number;
  } | null;
};

export type StayCrawlServiceRef = {
  service_id: number;
  code: string;
  service_category_id?: number | null;
  slug_full?: string | null;
  level?: number | null;
  parent_id?: number | null;
};

export const stayCrawlsApi = {
  jobs: (query?: Record<string, string | number | undefined>) =>
    apiRequest<{ items: StayCrawlJob[] }>('/stay-crawls/jobs', { query }),
  job: (id: number, query?: Record<string, string | number | undefined>) =>
    apiRequest<{ job: StayCrawlJob; items: StayCrawlItem[]; stats?: { total: number; done: number; failed: number; blocked: number; queued: number } }>(`/stay-crawls/jobs/${id}`, { query }),
  retryItem: (id: number) =>
    apiRequest<{ item: StayCrawlItem; message: string }>(`/stay-crawls/items/${id}/retry`, { method: 'POST' }),
  retryFailed: (jobId: number) =>
    apiRequest<{ retried_count: number; message: string }>(`/stay-crawls/jobs/${jobId}/retry-failed`, { method: 'POST' }),
  _old_job: (id: number) =>
    apiRequest<{ job: StayCrawlJob; items: StayCrawlItem[] }>(`/stay-crawls/jobs/${id}`),
  items: (query?: Record<string, string | number | undefined>) =>
    apiRequest<{ items: StayCrawlItem[] }>('/stay-crawls/items', { query }),
  enqueueList: (body: Record<string, unknown>) =>
    apiRequest<{ job: StayCrawlJob; urls: string[] }>('/stay-crawls/jobs', { method: 'POST', body }),
  status: () =>
    apiRequest<{
      driver: string;
      browser_ready: boolean;
      node_bin?: string | null;
      puppeteer_installed?: boolean;
      script_ok?: boolean;
      ready_hint?: string | null;
      chrome_bin?: string | null;
      proxy_configured: boolean;
      proxy_enabled_default: boolean;
      headless?: boolean;
      headed?: boolean;
      slow_mo?: number;
    }>('/stay-crawls/status'),
  fromCategory: (body: Record<string, unknown>) => {
    const rerun = typeof body.rerun === 'string' ? body.rerun : undefined;
    const from = typeof body.from === 'string' ? body.from : undefined;
    const payload = { ...body };
    const headers: Record<string, string> = {};
    const query: Record<string, string> = {};
    if (rerun) {
      headers['X-Stay-Crawl-Rerun'] = rerun;
      query.rerun = rerun;
    }
    if (from) {
      headers['X-Stay-Crawl-From'] = from;
      query.from = from;
    }
    return apiRequest<{
      job: StayCrawlJob;
      urls: string[];
      items: StayCrawlItem[];
      is_listing_async?: boolean;
      worker?: StayCrawlJob['worker'];
      worker_hint?: string;
      queue_hint?: string | null;
      queue?: Record<string, unknown> | null;
      queued?: { dispatched?: number; item_ids?: number[] };
    }>(
      '/stay-crawls/from-category',
      {
        method: 'POST',
        body: payload,
        query: Object.keys(query).length ? query : undefined,
        headers: Object.keys(headers).length ? headers : undefined,
        timeoutMs: 420_000,
      },
    );
  },
  processNext: (id: number, body?: Record<string, unknown>) =>
    apiRequest<{
      done: boolean;
      busy?: boolean;
      remaining: number;
      imported: number;
      blocked: number;
      failed: number;
      total: number;
      urls_found?: number;
      stream?: Record<string, unknown> | null;
      job: StayCrawlJob;
      item: StayCrawlItem | null;
      service: StayCrawlServiceRef | null;
      phase?: string | null;
      message?: string | null;
      last_step?: {
        seq?: number;
        phase?: string | null;
        message?: string | null;
        done?: boolean;
        imported?: number;
        blocked?: number;
        failed?: number;
        remaining?: number;
        item_id?: number | null;
        source_url?: string | null;
        item_status?: string | null;
        blocked_reason?: string | null;
        error?: string | null;
      } | null;
    }>(`/stay-crawls/jobs/${id}/process-next`, { method: 'POST', body, timeoutMs: 25_000 }),
  startWork: (id: number, body?: Record<string, unknown>) =>
    apiRequest<{ job: StayCrawlJob; worker?: StayCrawlJob['worker']; worker_hint?: string }>(
      `/stay-crawls/jobs/${id}/work`,
      { method: 'POST', body },
    ),
  pauseWork: (id: number) =>
    apiRequest<{ job: StayCrawlJob; worker?: StayCrawlJob['worker'] }>(`/stay-crawls/jobs/${id}/pause`, {
      method: 'POST',
    }),
  resumeWork: (id: number, body?: Record<string, unknown>) =>
    apiRequest<{ job: StayCrawlJob; worker?: StayCrawlJob['worker']; worker_hint?: string }>(
      `/stay-crawls/jobs/${id}/resume`,
      { method: 'POST', body },
    ),
  enqueueHotel: (body: Record<string, unknown>) =>
    apiRequest<{ item: StayCrawlItem }>('/stay-crawls/items', { method: 'POST', body }),
  ingest: (body: Record<string, unknown>) =>
    apiRequest<StayCrawlServiceRef & { item: StayCrawlItem }>('/stay-crawls/ingest', {
      method: 'POST',
      body,
    }),
  detail: (id: number, body?: Record<string, unknown>) =>
    apiRequest<{ item: StayCrawlItem }>(`/stay-crawls/items/${id}/detail`, { method: 'POST', body }),
  map: (id: number) =>
    apiRequest<{ item: StayCrawlItem }>(`/stay-crawls/items/${id}/map`, { method: 'POST' }),
  ai: (id: number, body?: Record<string, unknown>) =>
    apiRequest<{ item: StayCrawlItem }>(`/stay-crawls/items/${id}/map`, { method: 'POST', body }),
  import: (id: number, body?: Record<string, unknown>) =>
    apiRequest<StayCrawlServiceRef & { item: StayCrawlItem }>(
      `/stay-crawls/items/${id}/import`,
      { method: 'POST', body },
    ),
};

export const mediaApi = {
  meta: () =>
    apiRequest<{
      max_upload_kb: number;
      accept: string[];
      folders: string[];
      hint: string;
    }>('/media/meta'),
  videoMeta: () =>
    apiRequest<{
      max_upload_kb: number;
      accept: string[];
      hint: string;
    }>('/media/video-meta'),
  library: (query?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<
      Paginated<MediaImage> & {
        folders?: { key: string; path: string }[];
      }
    >('/media/library', { query }),
  getLibrary: (id: number) => apiRequest<MediaImage>(`/media/library/${id}`),
  updateLibrary: (id: number, body: { alt?: string | null; credit?: string | null }) =>
    apiRequest<MediaImage>(`/media/library/${id}`, { method: 'PUT', body }),
  removeLibrary: (id: number) =>
    apiRequest<null>(`/media/library/${id}`, { method: 'DELETE' }),
  upload: (
    file: File,
    opts: {
      folder: MediaFolder;
      variant?: 'thumb' | 'card' | 'lg' | 'full';
      /** SEO slug của trang / entity đang chỉnh — tạo URL thân thiện. */
      slug?: string | null;
      /** Vai trò ảnh: cover, banner, avatar, gallery… */
      role?: string | null;
      onProgress?: (pct: number) => void;
      signal?: AbortSignal;
    },
  ) =>
    new Promise<MediaImage>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);
      form.append('folder', opts.folder);
      if (opts.variant) form.append('variant', opts.variant);
      const slug = (opts.slug || '').trim();
      if (slug) form.append('slug', slug);
      const role = (opts.role || '').trim();
      if (role) form.append('role', role);

      xhr.open('POST', `${getApiBase()}/media/upload`);
      xhr.setRequestHeader('Accept', 'application/json');
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const projectCode = getProjectCode();
      if (projectCode) xhr.setRequestHeader('X-Project-Code', projectCode);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || !opts.onProgress) return;
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      };

      const onAbort = () => xhr.abort();
      opts.signal?.addEventListener('abort', onAbort);

      xhr.onload = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        let json: { success?: boolean; data?: MediaImage; error?: { message?: string; code?: string } } | null =
          null;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiClientError('Phản hồi upload không hợp lệ.', 'INVALID_RESPONSE', xhr.status));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && json?.success && json.data) {
          resolve(json.data);
          return;
        }
        reject(
          new ApiClientError(
            json?.error?.message || 'Upload ảnh thất bại.',
            json?.error?.code || 'UPLOAD_ERROR',
            xhr.status,
          ),
        );
      };

      xhr.onerror = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(new ApiClientError('Không kết nối được khi upload ảnh.', 'NETWORK_ERROR', 0));
      };

      xhr.onabort = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(new ApiClientError('Đã huỷ upload.', 'ABORTED', 0));
      };

      xhr.send(form);
    }),
  uploadVideo: (
    file: File,
    opts: {
      folder?: MediaFolder;
      onProgress?: (pct: number) => void;
      signal?: AbortSignal;
    } = {},
  ) =>
    new Promise<MediaImage>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);
      form.append('folder', opts.folder || 'video_files');

      xhr.open('POST', `${getApiBase()}/media/upload-video`);
      xhr.setRequestHeader('Accept', 'application/json');
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const projectCode = getProjectCode();
      if (projectCode) xhr.setRequestHeader('X-Project-Code', projectCode);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || !opts.onProgress) return;
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      };

      const onAbort = () => xhr.abort();
      opts.signal?.addEventListener('abort', onAbort);

      xhr.onload = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        let json: { success?: boolean; data?: MediaImage; error?: { message?: string; code?: string } } | null =
          null;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiClientError('Phản hồi upload không hợp lệ.', 'INVALID_RESPONSE', xhr.status));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && json?.success && json.data) {
          resolve(json.data);
          return;
        }
        reject(
          new ApiClientError(
            json?.error?.message || 'Upload video thất bại.',
            json?.error?.code || 'UPLOAD_ERROR',
            xhr.status,
          ),
        );
      };

      xhr.onerror = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(new ApiClientError('Không kết nối được khi upload video.', 'NETWORK_ERROR', 0));
      };

      xhr.onabort = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(new ApiClientError('Đã huỷ upload.', 'ABORTED', 0));
      };

      xhr.send(form);
    }),
};

type CrudListQuery = Record<string, string | number | boolean | undefined>;

/** Row CRUD generic — luôn có id (list + create/update). */
export type CrudRecord = { id: number } & Record<string, unknown>;

function crudApi<TList extends { id: number } = CrudRecord, TDetail extends { id: number } = TList>(
  base: string,
) {
  return {
    list: (query?: CrudListQuery) => apiRequest<Paginated<TList>>(base, { query }),
    get: (id: number, locale = 'vi') =>
      apiRequest<TDetail>(`${base}/${id}`, { query: { locale } }),
    create: (body: Record<string, unknown>) =>
      apiRequest<TDetail>(base, { method: 'POST', body }),
    update: (id: number, body: Record<string, unknown>) =>
      apiRequest<TDetail>(`${base}/${id}`, { method: 'PUT', body }),
    remove: (id: number) => apiRequest<null>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const homeSlidesApi = {
  ...crudApi<CrudRecord>('/home-slides'),
  meta: () => apiRequest<Record<string, unknown>>('/home-slides/meta'),
};

export const homeSectionsApi = {
  get: (locale = 'vi') => apiRequest<Record<string, unknown>>('/home-sections', { query: { locale } }),
  update: (body: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/home-sections', { method: 'PUT', body }),
};

export const blogCategoriesApi = {
  ...crudApi<CrudRecord>('/blog-categories'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/blog-categories/meta', { query: { locale } }),
};

export const articlesApi = {
  ...crudApi<CrudRecord>('/articles'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/articles/meta', { query: { locale } }),
};

export const teamMembersApi = {
  ...crudApi<CrudRecord>('/team-members'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/team-members/meta', { query: { locale } }),
};

export const officesApi = {
  ...crudApi<CrudRecord>('/offices'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/offices/meta', { query: { locale } }),
};

export const companyProfileApi = {
  get: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/company-profile', { query: { locale } }),
  update: (body: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/company-profile', { method: 'PUT', body }),
};

export const companyValuesApi = crudApi<CrudRecord>('/company-values');
export const reasonsApi = crudApi<CrudRecord>('/reasons');
export const referencePersonsApi = crudApi<CrudRecord>('/reference-persons');
export const reviewsApi = {
  ...crudApi<CrudRecord>('/reviews'),
  meta: () => apiRequest<Record<string, unknown>>('/reviews/meta'),
};
export const reviewPlatformsApi = crudApi<CrudRecord>('/review-platforms');

export const galleryAlbumsApi = {
  ...crudApi<CrudRecord>('/gallery-albums'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/gallery-albums/meta', { query: { locale } }),
};

export const videosApi = {
  ...crudApi<CrudRecord>('/videos'),
  meta: (locale = 'vi') =>
    apiRequest<Record<string, unknown>>('/videos/meta', { query: { locale } }),
};

export const leadsApi = {
  quickInquiries: (query?: CrudListQuery) =>
    apiRequest<Paginated<Record<string, unknown>> & { statuses?: ValueLabel[] }>(
      '/leads/quick-inquiries',
      { query },
    ),
  updateQuickInquiryStatus: (id: number, status: string) =>
    apiRequest(`/leads/quick-inquiries/${id}/status`, { method: 'PUT', body: { status } }),
  customTours: (query?: CrudListQuery) =>
    apiRequest<Paginated<Record<string, unknown>> & { statuses?: ValueLabel[] }>(
      '/leads/custom-tours',
      { query },
    ),
  updateCustomTourStatus: (id: number, status: string) =>
    apiRequest(`/leads/custom-tours/${id}/status`, { method: 'PUT', body: { status } }),
  contacts: (query?: CrudListQuery) =>
    apiRequest<Paginated<Record<string, unknown>> & { statuses?: ValueLabel[] }>(
      '/leads/contacts',
      { query },
    ),
  updateContactStatus: (id: number, status: string) =>
    apiRequest(`/leads/contacts/${id}/status`, { method: 'PUT', body: { status } }),
};

export const commentsApi = {
  list: (query?: CrudListQuery) =>
    apiRequest<Paginated<Record<string, unknown>>>('/comments', { query }),
  approve: (id: number) => apiRequest(`/comments/${id}/approve`, { method: 'POST' }),
  reject: (id: number) => apiRequest(`/comments/${id}/reject`, { method: 'POST' }),
};

export const languagesApi = {
  list: () => apiRequest<{ items: Record<string, unknown>[] }>('/languages'),
};

export const cacheApi = {
  meta: () =>
    apiRequest<{ total_files: number; batch_size: number }>('/cache/meta'),
  clear: () => apiRequest<{ cleared: number }>('/cache/clear', { method: 'POST' }),
  clearBatch: (limit = 80) =>
    apiRequest<{
      deleted: number;
      remaining: number;
      total_before: number;
      done: boolean;
    }>('/cache/clear-batch', { method: 'POST', body: { limit } }),
  finish: () =>
    apiRequest<{ menu_cleared: boolean }>('/cache/finish', { method: 'POST' }),
};

export const listingHubsApi = {
  get: (hubKey: string, locale = 'vi') =>
    apiRequest<Record<string, unknown>>(`/listing-hubs/${hubKey}`, { query: { locale } }),
  update: (hubKey: string, body: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`/listing-hubs/${hubKey}`, { method: 'PUT', body }),
};

export const priceGuestTypesApi = {
  list: (locale = 'vi') =>
    apiRequest<{
      items: PriceGuestType[];
      units: Record<string, string>;
      period_kinds: Record<string, string>;
    }>('/price-guest-types', { query: { locale } }),
  create: (body: Record<string, unknown>) =>
    apiRequest<PriceGuestType>('/price-guest-types', { method: 'POST', body }),
  update: (id: number, body: Record<string, unknown>) =>
    apiRequest<PriceGuestType>(`/price-guest-types/${id}`, { method: 'PUT', body }),
  remove: (id: number) => apiRequest<null>(`/price-guest-types/${id}`, { method: 'DELETE' }),
};
