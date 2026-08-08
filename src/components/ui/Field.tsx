'use client';

import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Field, FieldLockIcon } from '@/components/ui/FieldShell';
import { useStructureLocked } from '@/hooks/useStructureLock';

export { Field, FieldLockIcon } from '@/components/ui/FieldShell';
export { Select } from '@/components/ui/Select';
export type { SelectOption } from '@/components/ui/Select';
export { MultiSelect } from '@/components/ui/MultiSelect';
import { FieldTip } from '@/components/ui/FieldTip';
import { useAiFilled, useAiFilledActions } from '@/hooks/useAiFilledFields';

export { FieldTip };

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Prefix trong box (vd. chip URL cha). */
  leading?: ReactNode;
  /** Key đánh dấu AI filled — mặc định lấy từ name. */
  aiFieldKey?: string;
};

export function Input({
  label,
  hint,
  error,
  className,
  id,
  required,
  leading,
  disabled,
  aiFieldKey,
  onChange,
  onFocus,
  name,
  ...rest
}: InputProps) {
  const inputId = id || (typeof name === 'string' ? name : undefined);
  const fieldKey = aiFieldKey || (typeof name === 'string' ? name : undefined);
  const aiFilled = useAiFilled(fieldKey);
  const { clear } = useAiFilledActions();

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={required}
      locked={!!disabled}
      aiFilled={aiFilled}
    >
      <div
        className={clsx(
          'ui-field__box',
          leading && 'ui-field__box--with-leading',
          error && 'ui-field__box--error',
          disabled && 'ui-field__box--locked',
          aiFilled && 'ui-field__box--ai-filled',
        )}
      >
        {leading ? <div className="ui-field__leading">{leading}</div> : null}
        <input
          id={inputId}
          name={name}
          className={clsx('ui-field__control', className)}
          required={required}
          disabled={disabled}
          onFocus={(e) => {
            if (fieldKey) clear(fieldKey);
            onFocus?.(e);
          }}
          onChange={(e) => {
            if (fieldKey) clear(fieldKey);
            onChange?.(e);
          }}
          {...rest}
        />
        {disabled ? <FieldLockIcon /> : null}
      </div>
    </Field>
  );
}

type MoneyInputProps = Omit<InputProps, 'type' | 'value' | 'onChange' | 'leading'> & {
  value: string;
  onValueChange: (rawDigits: string) => void;
};

/** Hiển thị 28,000,000 — lưu chuỗi số thuần (không dấu). */
export function MoneyInput({
  label,
  hint,
  error,
  className,
  id,
  required,
  value,
  onValueChange,
  disabled,
  ...rest
}: MoneyInputProps) {
  const inputId = id || (typeof rest.name === 'string' ? rest.name : undefined);
  const digits = String(value ?? '').replace(/\D/g, '');
  const display = digits ? Number(digits).toLocaleString('en-US') : '';

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={required}
      locked={!!disabled}
    >
      <div className={clsx('ui-field__box', error && 'ui-field__box--error', disabled && 'ui-field__box--locked')}>
        <input
          id={inputId}
          inputMode="numeric"
          className={clsx('ui-field__control', className)}
          required={required}
          disabled={disabled}
          {...rest}
          value={display}
          onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
        />
        {disabled ? <FieldLockIcon /> : null}
      </div>
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  aiFieldKey?: string;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  required,
  disabled,
  aiFieldKey,
  onChange,
  onFocus,
  name,
  ...rest
}: TextareaProps) {
  const inputId = id || (typeof name === 'string' ? name : undefined);
  const fieldKey = aiFieldKey || (typeof name === 'string' ? name : undefined);
  const aiFilled = useAiFilled(fieldKey);
  const { clear } = useAiFilledActions();

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={required}
      locked={!!disabled}
      aiFilled={aiFilled}
    >
      <div
        className={clsx(
          'ui-field__box',
          error && 'ui-field__box--error',
          disabled && 'ui-field__box--locked',
          disabled && 'ui-field__box--locked-textarea',
          aiFilled && 'ui-field__box--ai-filled',
        )}
      >
        <textarea
          id={inputId}
          name={name}
          className={clsx('ui-field__control', 'ui-field__control--textarea', className)}
          required={required}
          disabled={disabled}
          onFocus={(e) => {
            if (fieldKey) clear(fieldKey);
            onFocus?.(e);
          }}
          onChange={(e) => {
            if (fieldKey) clear(fieldKey);
            onChange?.(e);
          }}
          {...rest}
        />
        {disabled ? <FieldLockIcon /> : null}
      </div>
    </Field>
  );
}

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  hint?: string;
  disabled?: boolean;
  /** Mặc định true — khóa khi đang sửa bản dịch (≠ locale cấu trúc). */
  structure?: boolean;
};

export function Switch({
  label,
  checked,
  onChange,
  name,
  hint,
  disabled,
  structure = true,
}: SwitchProps) {
  const locked = useStructureLocked();
  const isDisabled = !!disabled || (structure && locked);

  return (
    <div className={clsx('ui-switch-wrap', isDisabled && 'ui-switch-wrap--disabled')}>
      <label className={clsx('ui-switch', isDisabled && 'ui-switch--disabled')}>
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={isDisabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ui-switch__track" />
        <span className="ui-switch__label">{label}</span>
        {isDisabled ? <FieldLockIcon className="ui-switch__lock" /> : null}
      </label>
      {hint ? (
        <span className="ui-switch__tip">
          <FieldTip>{hint}</FieldTip>
        </span>
      ) : null}
    </div>
  );
}
