'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import { Field } from '@/components/ui/FieldShell';
import { FieldLockIcon } from '@/components/ui/FieldShell';
import { useFloatingPanel, type FloatingPanelOptions } from '@/hooks/useFloatingPanel';
import { useAiFilled, useAiFilledActions } from '@/hooks/useAiFilledFields';

export type SelectOption = {
  value: string | number;
  label: string;
};

type SelectProps = {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  value?: string | number;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  /** Key đánh dấu AI filled — mặc định lấy từ name. */
  aiFieldKey?: string;
  onChange?: (value: string) => void;
  /** Native-like event for gradual migration */
  onChangeEvent?: (e: { target: { value: string; name?: string } }) => void;
  /** Độ rộng tối thiểu drawer — không kẹt theo trigger hẹp (header). */
  panelMinWidth?: number;
  /** Căn drawer theo cạnh trigger. */
  panelAlign?: FloatingPanelOptions['align'];
  preferredMaxHeight?: number;
};

export function Select({
  label,
  hint,
  error,
  options,
  value = '',
  placeholder = 'Chọn…',
  searchable = false,
  disabled,
  required,
  name,
  className,
  aiFieldKey,
  onChange,
  onChangeEvent,
  panelMinWidth,
  panelAlign,
  preferredMaxHeight = 280,
}: SelectProps) {
  const id = useId();
  const fieldKey = aiFieldKey || name;
  const aiFilled = useAiFilled(fieldKey);
  const { clear } = useAiFilledActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const panelStyle = useFloatingPanel(open, triggerRef, {
    preferredMaxHeight,
    minWidth: panelMinWidth,
    align: panelAlign,
  });

  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value],
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

  const pick = (next: string) => {
    if (fieldKey) clear(fieldKey);
    onChange?.(next);
    onChangeEvent?.({ target: { value: next, name } });
    setOpen(false);
    setQuery('');
  };

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="ui-select__panel ui-select__panel--portal"
            role="listbox"
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
              {placeholder ? (
                <button
                  type="button"
                  className={clsx('ui-select__option', value === '' && 'ui-select__option--active')}
                  onClick={() => pick('')}
                >
                  <span>{placeholder}</span>
                </button>
              ) : null}
              {filtered.length === 0 ? (
                <div className="ui-select__empty">Không có lựa chọn</div>
              ) : (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={clsx('ui-select__option', active && 'ui-select__option--active')}
                      onClick={() => pick(String(opt.value))}
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
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      className={className}
      required={required}
      locked={!!disabled}
      aiFilled={aiFilled}
    >
      <div
        className={clsx(
          'ui-select',
          open && 'ui-select--open',
          disabled && 'ui-select--disabled',
          aiFilled && 'ui-select--ai-filled',
        )}
        ref={rootRef}
      >
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className={clsx(
            'ui-select__trigger',
            error && 'ui-select__trigger--error',
            !selected && 'ui-select__trigger--placeholder',
            disabled && 'ui-select__trigger--locked',
            aiFilled && 'ui-select__trigger--ai-filled',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label || placeholder || 'Chọn'}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ui-select__value">{selected?.label || placeholder}</span>
          {disabled ? (
            <FieldLockIcon className="ui-select__lock" />
          ) : (
            <ChevronDown size={18} className="ui-select__chevron" />
          )}
        </button>

        {required ? (
          <input
            tabIndex={-1}
            aria-hidden
            className="ui-select__native"
            value={String(value)}
            required
            readOnly
            name={name}
          />
        ) : name ? (
          <input type="hidden" name={name} value={String(value)} />
        ) : null}

        {panel}
      </div>
    </Field>
  );
}
