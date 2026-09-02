'use client';

import { useRef } from 'react';
import clsx from 'clsx';
import { Languages } from 'lucide-react';
import type { LocaleOption } from '@/lib/locale';
import { useParentLocaleBlocked } from '@/hooks/useParentLocaleGate';
import { useLanguagesOptions } from '@/hooks/useLanguagesOptions';

/** Giữ tab cuối cùng khi prop tạm rỗng (query form đang tải lại). */
function useStableLanguages(languages: LocaleOption[]): {
  items: LocaleOption[];
  showingStale: boolean;
} {
  const lastRef = useRef<LocaleOption[]>([]);

  if (languages.length > 0) {
    lastRef.current = languages;
    return { items: languages, showingStale: false };
  }

  return {
    items: lastRef.current,
    showingStale: lastRef.current.length > 0,
  };
}

export function LocaleSwitcher({
  languages: languagesProp,
  value,
  onChange,
  disabled,
  hint,
  translatedLocales,
}: {
  languages?: LocaleOption[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  hint?: string;
  /** Locale đã có bản dịch — thiếu sẽ hiện xám (vẫn chọn được để tạo) */
  translatedLocales?: string[] | null;
}) {
  const fromProp = Array.isArray(languagesProp) ? languagesProp : [];
  const { languages: cached, isFetching } = useLanguagesOptions();
  const merged = fromProp.length > 0 ? fromProp : cached;
  const { items, showingStale } = useStableLanguages(merged);
  const parentBlocked = useParentLocaleBlocked();

  if (!items.length) return null;

  const readySet =
    translatedLocales == null ? null : new Set(translatedLocales.map((c) => c.toLowerCase()));
  const pending = showingStale || (isFetching && fromProp.length === 0);

  return (
    <div
      className={clsx(
        'ui-locale-switcher',
        disabled && 'ui-locale-switcher--disabled',
        pending && 'ui-locale-switcher--pending',
      )}
    >
      <div className="ui-locale-switcher__label">
        <Languages size={15} strokeWidth={2.2} aria-hidden />
        <span>Ngôn ngữ</span>
      </div>
      <div className="ui-locale-switcher__list" role="tablist" aria-label="Chọn ngôn ngữ chỉnh sửa">
        {items.map((lang) => {
          const active = lang.code === value;
          const ready = readySet == null ? true : readySet.has(lang.code.toLowerCase());
          const blockedActive = active && parentBlocked;
          const title = blockedActive
            ? `${lang.name_native || lang.name} — trang cha chưa có bản dịch này`
            : ready
              ? lang.name_native || lang.name
              : `${lang.name_native || lang.name} — chưa có bản dịch`;

          return (
            <button
              key={lang.code}
              type="button"
              role="tab"
              aria-selected={active}
              className={clsx(
                'ui-locale-switcher__item',
                active && 'ui-locale-switcher__item--active',
                !active && !ready && 'ui-locale-switcher__item--missing',
                blockedActive && 'ui-locale-switcher__item--parent-blocked',
              )}
              disabled={disabled || pending}
              title={title}
              onClick={() => onChange(lang.code)}
            >
              <span className="ui-locale-switcher__code">{lang.code.toUpperCase()}</span>
              <span className="ui-locale-switcher__name">{lang.name_native || lang.name}</span>
              {!ready && !active ? (
                <span className="ui-locale-switcher__dot" aria-hidden />
              ) : null}
              {blockedActive ? (
                <span className="ui-locale-switcher__warn" aria-hidden>
                  !
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hint ? <p className="ui-locale-switcher__hint">{hint}</p> : null}
      {parentBlocked ? (
        <p className="ui-locale-switcher__hint ui-locale-switcher__hint--danger">
          Tab đang chọn bị khóa vì trang cha chưa có bản dịch tương ứng.
        </p>
      ) : null}
    </div>
  );
}
