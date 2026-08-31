'use client';

/**
 * Options cho useQuery trên form edit — tắt live refetch để không đè bản đang sửa.
 * List / crawler / dashboard giữ default Providers (focus + interval).
 */
export const EDIT_FORM_QUERY_OPTIONS = {
  refetchOnWindowFocus: false as const,
  refetchInterval: false as const,
};
