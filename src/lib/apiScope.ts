/**
 * Gắn X-Project-Code theo queryKey[0] khi chạy queryFn — tránh race khi đổi dự án nhanh
 * (request in-flight đọc localStorage/project hiện tại → cache nhầm slot).
 */
let activeRequestProject: string | null = null;

export function runWithProjectScope<T>(projectCode: string, fn: () => Promise<T>): Promise<T> {
  const prev = activeRequestProject;
  activeRequestProject = projectCode;
  return fn().finally(() => {
    activeRequestProject = prev ?? null;
  });
}

export function getActiveRequestProject(): string | null {
  return activeRequestProject;
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
