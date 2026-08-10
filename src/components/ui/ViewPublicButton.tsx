'use client';

import { Eye } from 'lucide-react';
import { HeadCta } from '@/components/ui/HeadActions';
import { useStableViewHref } from '@/hooks/useStableViewHref';

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
  const stableHref = useStableViewHref(href);
  if (!stableHref) return null;

  return (
    <HeadCta
      href={stableHref}
      external
      icon={Eye}
      title={title}
      subtitle={subtitle}
      className={className}
    />
  );
}
