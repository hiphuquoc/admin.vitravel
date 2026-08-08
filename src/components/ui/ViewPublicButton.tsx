'use client';

import { Eye } from 'lucide-react';
import { HeadCta } from '@/components/ui/HeadActions';

/** CatHead CTA — mở trang public (tab mới). */
export function ViewPublicButton({
  href,
  title = 'Xem trang',
  subtitle = 'Mở trên website',
  className,
}: {
  href: string | null | undefined;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  if (!href) return null;

  return (
    <HeadCta
      href={href}
      external
      icon={Eye}
      title={title}
      subtitle={subtitle}
      className={className}
    />
  );
}
