'use client';

import Link from 'next/link';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Cụm action CatHead: primary full-width · secondary 75% (1 nút) / 2 cột (≥2). */
export function HeadActions({
  primary,
  secondary,
  className,
}: {
  primary?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('ui-head-actions', className)}>
      {primary}
      {secondary ? <div className="ui-head-actions__secondary">{secondary}</div> : null}
    </div>
  );
}

type HeadCtaProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

/** Primary CatHead CTA — gradient, icon + 2 dòng + mũi tên. */
export function HeadCta({
  title,
  subtitle,
  icon: Icon,
  className,
  href,
  external,
  onClick,
  type = 'button',
  disabled,
}: HeadCtaProps) {
  const classes = clsx('ui-cat-cta', 'ui-cat-cta--create', 'ui-head-actions__primary', className);
  const body = (
    <>
      <span className="ui-cat-cta__icon" aria-hidden>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className="ui-cat-cta__text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="ui-cat-cta__arrow" aria-hidden>
        →
      </span>
    </>
  );

  if (href && external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        title={title}
      >
        {body}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classes} title={title}>
        {body}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} title={title} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}

type HeadSecondaryProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

/** Secondary CatHead btn — cùng layout 2 dòng, nền surface (secondary hiện tại). */
export function HeadSecondary({
  title,
  subtitle,
  icon: Icon,
  className,
  href,
  onClick,
  type = 'button',
  disabled,
}: HeadSecondaryProps) {
  const classes = clsx('ui-head-btn', className);
  const body = (
    <>
      <span className="ui-head-btn__icon" aria-hidden>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className="ui-head-btn__label">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} title={title}>
        {body}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} title={title} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}
