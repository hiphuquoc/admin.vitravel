'use client';

import { SuperAdminOnly } from '@/components/catalog/SuperAdminOnly';

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminOnly>{children}</SuperAdminOnly>;
}
