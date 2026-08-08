import clsx from 'clsx';

type PageLoaderProps = {
  label?: string;
  hint?: string;
  /** `page` = vùng content; `screen` = full viewport (auth boot); `inline` = khối nhỏ. */
  variant?: 'page' | 'screen' | 'inline';
  className?: string;
};

/**
 * Loading dùng chung — boot auth / Suspense nhẹ / khối nội dung.
 * Chuyển route dashboard dùng thanh top progress (không thay cả trang bằng loader).
 */
export function PageLoader({
  label,
  hint,
  variant = 'page',
  className,
}: PageLoaderProps) {
  const isScreen = variant === 'screen';
  const title = label ?? (isScreen ? 'ViTravel Admin' : 'Đang tải…');
  const subtitle =
    hint ?? (isScreen ? 'Đang khởi tạo phiên làm việc' : 'Vui lòng chờ trong giây lát');

  return (
    <div
      className={clsx('ui-page-loader', `ui-page-loader--${variant}`, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {isScreen ? <div className="ui-page-loader__atmosphere" aria-hidden /> : null}

      <div className="ui-page-loader__card">
        <div className="ui-page-loader__brand" aria-hidden>
          <span className="ui-page-loader__mark">V</span>
          <span className="ui-page-loader__ring" />
          <span className="ui-page-loader__ring ui-page-loader__ring--delay" />
        </div>

        <div className="ui-page-loader__copy">
          <p className="ui-page-loader__title">{title}</p>
          <p className="ui-page-loader__hint">{subtitle}</p>
        </div>

        <div className="ui-page-loader__track" aria-hidden>
          <span className="ui-page-loader__track-bar" />
        </div>
      </div>
    </div>
  );
}

export default PageLoader;
