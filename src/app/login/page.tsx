import { Suspense } from 'react';
import LoginPage from './page-client';

export const metadata = {
  title: 'Đăng nhập',
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Đang tải…</div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
