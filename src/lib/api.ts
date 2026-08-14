import type { ApiErrorBody, ApiSuccessBody } from './types';

const TOKEN_KEY = 'vt_admin_token';
const USER_KEY = 'vt_admin_user';
const PROJECT_KEY = 'vt_admin_project_code';

export function getBasePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
}

export function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Dev fallback relative (Next rewrite). Production build phải có NEXT_PUBLIC_API_BASE.
  return '/api/v1/admin';
}

export function adminPath(path = '/'): string {
  const base = getBasePath();
  let clean = path.startsWith('/') ? path : `/${path}`;
  if (clean !== '/' && !clean.endsWith('/') && !clean.includes('?') && !clean.includes('#')) {
    clean = `${clean}/`;
  }
  if (!base) {
    return clean;
  }
  return `${base}${clean === '/' ? '/' : clean}`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getProjectCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PROJECT_KEY);
}

export function setProjectCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  if (!code) {
    localStorage.removeItem(PROJECT_KEY);
    return;
  }
  localStorage.setItem(PROJECT_KEY, code);
}

export function setSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROJECT_KEY);
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function formatValidationMessage(message?: string, details?: unknown): string {
  const base = (message || '').trim();
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const first = Object.values(details as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .find((v) => typeof v === 'string' && v.trim() !== '' && !String(v).startsWith('validation.'));
    if (typeof first === 'string') return first;
  }
  return base;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  signal?: AbortSignal;
  /** Skip JSON Content-Type (FormData uploads). */
  formData?: boolean;
};

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal, formData = false } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined && !formData && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const projectCode = getProjectCode();
    if (projectCode) headers['X-Project-Code'] = projectCode;
  }

  const url = `${getApiBase()}${path}${buildQuery(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData || formData
            ? (body as BodyInit)
            : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const base = getApiBase();
    const hint =
      typeof window !== 'undefined' && base.startsWith('http') && !base.includes(window.location.host)
        ? ' Thường do CORS: thêm origin admin vào Laravel CORS_ALLOWED_ORIGINS / ADMIN_APP_URL, rồi php artisan config:cache.'
        : ' Kiểm tra Laravel đang chạy, hoặc npm run dev còn sống.';
    throw new ApiClientError(
      `Không kết nối được API (${base}).${hint}`,
      'NETWORK_ERROR',
      0,
      err instanceof Error ? err.message : err,
    );
  }

  const raw = await res.text();
  let json: ApiSuccessBody<T> | ApiErrorBody | null = null;
  try {
    json = raw ? (JSON.parse(raw) as ApiSuccessBody<T> | ApiErrorBody) : null;
  } catch {
    const hint = raw.trim().startsWith('<')
      ? ' Máy chủ trả HTML (lỗi PHP / trang 500). Xem storage/logs/laravel.log.'
      : '';
    throw new ApiClientError(
      res.status === 404
        ? 'Không tìm thấy API. Kiểm tra route /api/v1/admin.'
        : `Phản hồi máy chủ không hợp lệ (HTTP ${res.status}).${hint}`,
      'INVALID_RESPONSE',
      res.status,
    );
  }

  if (!res.ok || !json || !('success' in json) || json.success === false) {
    const err = (json as ApiErrorBody)?.error;
    if (auth && res.status === 401 && typeof window !== 'undefined') {
      clearSession();
      const loginPath = adminPath('/login/');
      if (!window.location.pathname.includes('/login')) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `${loginPath}?next=${encodeURIComponent(next)}`;
      }
    }
    throw new ApiClientError(
      formatValidationMessage(err?.message, err?.details) ||
        (res.status >= 500 ? 'Lỗi máy chủ. Thử lại sau.' : 'Đã xảy ra lỗi.'),
      err?.code || 'ERROR',
      res.status,
      err?.details,
    );
  }

  return (json as ApiSuccessBody<T>).data;
}
