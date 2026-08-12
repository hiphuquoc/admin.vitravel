'use client';

import type { ReactNode } from 'react';
import { Image as ImageIcon, PanelsTopLeft } from 'lucide-react';
import clsx from 'clsx';

/** Copy cố định — mọi trang nội dung dùng chung. */
export const FORM_THUMB_COPY = {
  title: 'Ảnh đại diện',
  description: 'Thumbnail / chia sẻ',
} as const;

export const FORM_BANNER_COPY = {
  title: 'Banner listing',
  description: 'Hero first-view trang listing',
} as const;

export const FORM_GALLERY_COPY = {
  title: 'Gallery chi tiết',
  description: 'Click khung để chọn nhiều ảnh cùng lúc',
} as const;

type FormMediaCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** `thumb` = ảnh đại diện; `banner` = banner ngang. */
  variant?: 'thumb' | 'banner';
  icon?: ReactNode;
};

/**
 * Card media đơn — thumbnail hoặc banner.
 * Xếp nhiều card trong `FormMediaAside`.
 */
export function FormMediaCard({
  title,
  description,
  children,
  className,
  variant = 'thumb',
  icon,
}: FormMediaCardProps) {
  const defaultIcon =
    variant === 'banner' ? (
      <PanelsTopLeft size={16} strokeWidth={2.15} />
    ) : (
      <ImageIcon size={16} strokeWidth={2.15} />
    );

  return (
    <div className={clsx('ui-media-card', `ui-media-card--${variant}`, className)}>
      <header className="ui-media-card__head">
        <span className="ui-media-card__icon" aria-hidden>
          {icon ?? defaultIcon}
        </span>
        <div className="ui-media-card__head-copy">
          <h3 className="ui-media-card__title">{title}</h3>
          {description ? <p className="ui-media-card__desc">{description}</p> : null}
        </div>
      </header>
      <div className="ui-media-card__body">{children}</div>
    </div>
  );
}

/** Box thumbnail chuẩn — title/desc cố định toàn dự án. */
export function FormThumbCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormMediaCard
      variant="thumb"
      title={FORM_THUMB_COPY.title}
      description={FORM_THUMB_COPY.description}
      className={className}
    >
      {children}
    </FormMediaCard>
  );
}

/** Box banner listing chuẩn. */
export function FormBannerCard({
  children,
  description = FORM_BANNER_COPY.description,
  className,
}: {
  children: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <FormMediaCard
      variant="banner"
      title={FORM_BANNER_COPY.title}
      description={description}
      className={className}
    >
      {children}
    </FormMediaCard>
  );
}

/** Gallery dưới thumbnail — body chứa GalleryField multi-upload. */
export function FormGalleryCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormMediaCard
      variant="thumb"
      title={FORM_GALLERY_COPY.title}
      description={FORM_GALLERY_COPY.description}
      className={clsx('ui-media-card--gallery', className)}
    >
      {children}
    </FormMediaCard>
  );
}

type FormMediaAsideProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Cột phải form — sticky stack các FormMediaCard / FormThumbCard / FormBannerCard.
 */
export function FormMediaAside({ children, className }: FormMediaAsideProps) {
  return <aside className={clsx('ui-form-layout__aside', className)}>{children}</aside>;
}
