import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function FormSection({
  index,
  icon: Icon,
  title,
  description,
  children,
  variant = 'default',
  actions,
}: {
  index?: string | number;
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  /** `priority` — SEO / block luôn ưu tiên trên cùng */
  variant?: 'default' | 'priority';
  actions?: ReactNode;
}) {
  const rootClass =
    variant === 'priority' ? 'ui-form-section ui-form-section--priority' : 'ui-form-section';

  return (
    <section className={rootClass}>
      <header className="ui-form-section__head">
        {Icon ? (
          <span className="ui-form-section__icon" aria-hidden>
            <Icon size={17} strokeWidth={2.15} />
          </span>
        ) : index != null ? (
          <span className="ui-form-section__index">{index}</span>
        ) : null}
        <div className="ui-form-section__head-copy">
          {index != null && Icon ? (
            <span className="ui-form-section__kicker">Mục {index}</span>
          ) : null}
          <h2 className="ui-form-section__title">{title}</h2>
          {description ? <p className="ui-form-section__desc">{description}</p> : null}
        </div>
        {actions ? <div className="ui-form-section__actions">{actions}</div> : null}
      </header>
      <div className="ui-form-section__body">{children}</div>
    </section>
  );
}

export function FormCluster({
  title,
  children,
  cols = 2,
  variant,
}: {
  title?: string;
  children: ReactNode;
  cols?: 1 | 2 | 3;
  /** `picker` — cluster chọn danh sách (repeater), spacing gọn hơn. */
  variant?: 'default' | 'picker';
}) {
  const rootClass =
    variant === 'picker' ? 'ui-field ui-form-cluster--picker' : 'ui-form-cluster';

  return (
    <div className={rootClass}>
      {title ? (
        variant === 'picker' ? (
          <div className="ui-field__label">
            <span className="ui-field__label-text">{title}</span>
          </div>
        ) : (
          <div className="ui-form-cluster__title">{title}</div>
        )
      ) : null}
      <div
        className={
          cols === 1
            ? 'ui-form-grid'
            : cols === 3
              ? 'ui-form-grid ui-form-grid--3'
              : 'ui-form-grid ui-form-grid--2'
        }
      >
        {children}
      </div>
    </div>
  );
}
