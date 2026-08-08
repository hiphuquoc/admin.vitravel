'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiClientError, getBasePath } from '@/lib/api';
import { useAppRouter } from '@/hooks/useAppRouter';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

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
      <section className="login__visual">
        <div className="login__orb login__orb--1" />
        <div className="login__orb login__orb--2" />

        <div className="login__brand">
          <div className="login__mark">V</div>
          <div>
            <div className="login__name">ViTravel</div>
            <div className="login__tag">Hài lòng hơn cả mong đợi</div>
          </div>
        </div>

        <motion.div
          className="login__hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1>Điều hành hành trình với sự tinh tế của thương hiệu.</h1>
          <p>
            Console quản trị mới — nhanh, realtime, chuẩn API — sẵn sàng tách thành hệ thống dùng
            chung cho mọi site trên nền tảng.
          </p>
        </motion.div>

        <div className="login__stats">
          <div>
            <strong>Tour</strong>
            <span>Gói · Danh mục · Chủ đề</span>
          </div>
          <div>
            <strong>API</strong>
            <span>v1/admin · Bearer</span>
          </div>
          <div>
            <strong>UX</strong>
            <span>Rõ · Tròn · Mượt</span>
          </div>
        </div>
      </section>

      <section className="login__panel">
        <motion.div
          className="login__card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="login__card-title">Đăng nhập</h2>
          <p className="login__card-desc">Truy cập khu vực quản trị ViTravel Admin Console.</p>

          <form className="login__form" onSubmit={onSubmit}>
            {error ? <div className="login__error">{error}</div> : null}

            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domain.com"
            />

            <div style={{ position: 'relative' }}>
              <Input
                label="Mật khẩu"
                type={showPw ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '2.55rem',
                  color: 'var(--admin-muted)',
                }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="login__row">
              <label className="login__remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Ghi nhớ phiên
              </label>
            </div>

            <Button type="submit" block loading={loading}>
              <LogIn size={18} />
              Vào hệ thống
            </Button>
          </form>
        </motion.div>
      </section>
    </div>
  );
}
