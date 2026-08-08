'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme, type ThemeMode } from '@/lib/theme-context';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Hệ thống', icon: Monitor },
];

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();

  return (
    <div className="theme-switch" role="group" aria-label="Chế độ giao diện">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={clsx('theme-switch__btn', active && 'theme-switch__btn--active')}
            aria-pressed={active}
            title={opt.label}
            onClick={() => setMode(opt.value)}
          >
            <Icon size={16} />
            <span className="theme-switch__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
