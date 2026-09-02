/**
 * Gắn X-Project-Code theo queryKey[0] khi chạy scoped queryFn — tránh race khi đổi dự án nhanh
 * (request in-flight đọc localStorage/project hiện tại → cache nhầm slot).
 *
 * CHỈ dùng cho GET/fetch trong createScopedQueryFn. Mutation (PUT/POST/…) luôn dùng getProjectCode()
 * trong apiRequest — không kế thừa scope fetch đang chạy (tránh lưu nhầm dự án cũ).
 */
let scopedFetchProjectCode: string | null = null;

export function runWithProjectScope<T>(projectCode: string, fn: () => Promise<T>): Promise<T> {
  const prev = scopedFetchProjectCode;
  scopedFetchProjectCode = projectCode;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      scopedFetchProjectCode = prev;
    });
}

/** Project code của scoped query đang fetch — null nếu không trong queryFn. */
export function getScopedFetchProjectCode(): string | null {
  return scopedFetchProjectCode;
}

/** @deprecated Dùng getScopedFetchProjectCode — giữ tạm cho grep/docs cũ. */
export function getActiveRequestProject(): string | null {
  return scopedFetchProjectCode;
}

export function projectFromScopedKey(queryKey: readonly unknown[]): string {
  return String(queryKey[0] ?? '_');
}

/** Query key scoped có tiền tố projectCode khớp dự án đang chọn. */
export function isScopedQueryForProject(
  queryKey: readonly unknown[],
  activeProjectCode: string | null | undefined,
): boolean {
  return projectFromScopedKey(queryKey) === (activeProjectCode ?? '_');
}

export type ScopedQueryFnContext = {
  queryKey: readonly unknown[];
  signal: AbortSignal;
};
