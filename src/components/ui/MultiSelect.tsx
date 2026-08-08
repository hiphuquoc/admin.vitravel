'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { Field } from '@/components/ui/FieldShell';
import { FieldLockIcon } from '@/components/ui/FieldShell';
import type { SelectOption } from '@/components/ui/Select';
import { useFloatingPanel } from '@/hooks/useFloatingPanel';

type MultiSelectBaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
};

type MultiSelectNumberProps = MultiSelectBaseProps & {
  /** Khi false, giữ value dạng string (vd. permission keys). Mặc định true → number[]. */
  coerceNumber?: true;
  value: number[];
  onChange: (values: number[]) => void;
};

type MultiSelectStringProps = MultiSelectBaseProps & {
  coerceNumber: false;
  value: Array<string | number>;
  onChange: (values: string[]) => void;
};

type MultiSelectProps = MultiSelectNumberProps | MultiSelectStringProps;

export function MultiSelect({
  label,
  hint,
  error,
  options,
  value,
  placeholder = 'Chọn…',
  searchable = true,
  disabled,
  className,
  coerceNumber = true,
  onChange,
}: MultiSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const panelStyle = useFloatingPanel(open, triggerRef, 320);

  useEffect(() => setMounted(true), []);

  const selectedSet = useMemo(() => new Set(value.map(String)), [value]);

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(String(o.value))),
    [options, selectedSet],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emit = (next: string[]) => {
    if (coerceNumber) {
      (onChange as (values: number[]) => void)(
        next.map((v) => Number(v)).filter((n) => !Number.isNaN(n)),
      );
      return;
    }
    (onChange as (values: string[]) => void)(next);
  };

  const toggle = (raw: string | number) => {
    const key = String(raw);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    emit([...next]);
  };

  const remove = (raw: string | number) => {
    const next = new Set(selectedSet);
    next.delete(String(raw));
    emit([...next]);
  };

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="ui-select__panel ui-select__panel--portal"
            role="listbox"
            aria-multiselectable
            style={panelStyle}
          >
            {searchable ? (
              <div className="ui-select__search">
                <Search size={16} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm nhanh…"
                />
              </div>
            ) : null}
            <div className="ui-select__list">
              {filtered.length === 0 ? (
                <div className="ui-select__empty">Không có lựa chọn</div>
              ) : (
                filtered.map((opt) => {
                  const active = selectedSet.has(String(opt.value));
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={clsx('ui-select__option', active && 'ui-select__option--active')}
                      onClick={() => toggle(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {active ? (
                        <span className="ui-select__check" aria-hidden>
                          <Check size={13} strokeWidth={2.75} />
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className} locked={!!disabled}>
      <div
        className={clsx(
          'ui-select ui-select--multi',
          open && 'ui-select--open',
          disabled && 'ui-select--disabled',
        )}
        ref={rootRef}
      >
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className={clsx(
            'ui-select__trigger ui-select__trigger--multi',
            error && 'ui-select__trigger--error',
            selectedOptions.length === 0 && 'ui-select__trigger--placeholder',
            disabled && 'ui-select__trigger--locked',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="ui-select__chips">
            {selectedOptions.length === 0 ? (
              <span className="ui-select__value">{placeholder}</span>
            ) : (
              selectedOptions.map((opt) => (
                <span
                  key={String(opt.value)}
                  className="ui-select__chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(opt.value);
                  }}
                >
                  {opt.label}
                  <X size={13} />
                </span>
              ))
            )}
          </div>
          {disabled ? (
            <FieldLockIcon className="ui-select__lock" />
          ) : (
            <ChevronDown size={18} className="ui-select__chevron" />
          )}
        </button>

        {panel}
      </div>
    </Field>
  );
}
