'use client';

import { useAuth } from '@/lib/auth-context';

export function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.is_super_admin) {
    return (
      <div className="ui-card" style={{ padding: 24 }}>
        <h1>Không tìm thấy</h1>
        <p>Trang catalog chỗ nghỉ chỉ dành cho siêu quản trị.</p>
      </div>
    );
  }
  return <>{children}</>;
}
