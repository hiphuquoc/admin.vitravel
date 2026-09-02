/**
 * Phạm vi dự án cho form hydration — đồng bộ đồng bộ với localStorage (setProjectCode)
 * để beginFormHydration thấy đổi project ngay khi user chọn ở header, trước re-render.
 */
let currentProjectCode: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('vt_admin_project_code') : null;

export function setFormHydrationProjectScope(code: string | null): void {
  currentProjectCode = code;
}

export function getFormHydrationProjectScope(): string {
  return currentProjectCode ?? '_';
}
