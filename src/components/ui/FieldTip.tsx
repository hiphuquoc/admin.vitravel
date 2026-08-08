'use client';

import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

/** Tooltip gợi ý — icon ? cạnh label field. */
export function FieldTip({ children }: { children: ReactNode }) {
  const text = typeof children === 'string' ? children : null;

  return (
    <span className="ui-field-tip">
      <button
        type="button"
        className="ui-field-tip__btn"
        aria-label="Gợi ý"
        title={text || undefined}
        onClick={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <CircleHelp size={14} strokeWidth={2.25} aria-hidden />
      </button>
      <span className="ui-field-tip__bubble" role="tooltip">
        {children}
      </span>
    </span>
  );
}
