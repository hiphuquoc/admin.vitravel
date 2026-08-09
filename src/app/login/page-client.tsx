'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiClientError, getBasePath } from '@/lib/api';
import { useAppRouter } from '@/hooks/useAppRouter';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ViTravel Admin';
const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || 'Hài lòng hơn cả mong đợi';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useAppRouter();
  const search = useSearchParams();
  const rawNext = search.get('next') || '/';
  const base = getBasePath();
  const next =
    base && rawNext.startsWith(base) ? rawNext.slice(base.length) || '/' : rawNext;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, router, next]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      void remember;
      router.replace(next);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Không thể đăng nhập. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__atmosphere" aria-hidden>
        <span className="login__glow login__glow--a" />
        <span className="login__glow login__glow--b" />
        <span className="login__lines" />
        <span className="login__ring login__ring--lg" />
        <span className="login__ring login__ring--md" />
        <span className="login__ring login__ring--sm" />
        <span className="login__ring login__ring--tr" />
        <span className="login__grain" />
      </div>

      <motion.main
        className="login__stage"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="login__brand">
          <div className="login__mark" aria-hidden>
            V
          </div>
          <div className="login__brand-text">
            <h1 className="login__name">{APP_NAME}</h1>
            {APP_TAGLINE ? <p className="login__tagline">{APP_TAGLINE}</p> : null}
          </div>
        </header>

        <section className="login__card" aria-labelledby="login-heading">
          <h2 id="login-heading" className="login__heading">
            Đăng nhập
          </h2>

          <form className="login__form" onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="login__error" role="alert">
                {error}
              </div>
            ) : null}

            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />

            <div className="login__password">
              <Input
                label="Mật khẩu"
                type={showPw ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login__reveal"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPw ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>

            <label className="login__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Ghi nhớ phiên trên thiết bị này</span>
            </label>

            <Button type="submit" block loading={loading}>
              Đăng nhập
            </Button>
          </form>
        </section>

        <p className="login__footnote">Khu vực nội bộ · Chỉ dành cho nhân sự được cấp quyền</p>
      </motion.main>
    </div>
  );
}
