export type LocaleOption = {
  code: string;
  name: string;
  name_native: string;
  is_default: boolean;
};

export const DEFAULT_LOCALE = 'vi';

/** Ngôn ngữ mặc định (cấu trúc / tính năng) — thường `vi`. */
export function isDefaultLocale(locale: string, defaultLocale = DEFAULT_LOCALE): boolean {
  return String(locale || '').toLowerCase() === String(defaultLocale || DEFAULT_LOCALE).toLowerCase();
}

/**
 * Bản dịch khác mặc định chỉ được sửa nội dung có thể dịch.
 * Trường cấu trúc (status, switch, ảnh, trang cha, rating, ngày/đêm, …) phải khóa.
 */
export function isStructureLocked(locale: string, defaultLocale = DEFAULT_LOCALE): boolean {
  return !isDefaultLocale(locale, defaultLocale);
}

/** Chỉ nhận mảng locale admin (có `code`) — tránh nhầm field `languages` dạng string/list khác. */
export function asLocaleOptions(value: unknown): LocaleOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (
    value.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        typeof (item as { code?: unknown }).code !== 'string',
    )
  ) {
    return undefined;
  }
  return value as LocaleOption[];
}
