'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { authApi } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import { getToken, setSession } from '@/lib/api';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { FormCluster, FormSection } from '@/components/ui/FormSection';
import { FormFooter } from '@/components/ui/FormFooter';

type FormState = {
  name: string;
  email: string;
  current_password: string;
  password: string;
  password_confirmation: string;
};

const empty: FormState = {
  name: '',
  email: '',
  current_password: '',
  password: '',
  password_confirmation: '',
};

/** Hồ sơ cá nhân — tên, email, đổi mật khẩu. */
export default function AccountPage() {
  const { user, refreshMe } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const snapshotRef = useRef(JSON.stringify(empty));

  useEffect(() => {
    if (!user) return;
    const next: FormState = {
      ...empty,
      name: user.name,
      email: user.email,
    };
    setForm(next);
    snapshotRef.current = JSON.stringify(next);
  }, [user]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        name: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.password.trim()) {
        body.current_password = form.current_password;
        body.password = form.password;
        body.password_confirmation = form.password_confirmation;
      }
      return authApi.updateProfile(body);
    },
    onSuccess: async (updated) => {
      const token = getToken();
      if (token) setSession(token, updated);
      await refreshMe();
      const next: FormState = {
        name: updated.name,
        email: updated.email,
        current_password: '',
        password: '',
        password_confirmation: '',
      };
      setForm(next);
      snapshotRef.current = JSON.stringify(next);
      toast.success('Đã lưu hồ sơ');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <div>
      <PageHeader
        eyebrow="Tài khoản"
        title="Hồ sơ của tôi"
        description="Cập nhật tên hiển thị, email đăng nhập và mật khẩu."
      />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (form.password.trim() && form.password !== form.password_confirmation) {
            toast.error('Xác nhận mật khẩu không khớp.');
            return;
          }
          save.mutate();
        }}
        className="ui-form-stack"
      >
        <FormSection title="Thông tin" description="Tên và email dùng để đăng nhập admin.">
          <FormCluster>
            <Input
              label="Họ tên"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
          </FormCluster>
        </FormSection>

        <FormSection
          title="Đổi mật khẩu"
          description="Để trống nếu không muốn đổi. Cần nhập mật khẩu hiện tại khi đặt mật khẩu mới."
        >
          <FormCluster>
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(e) => set('current_password', e.target.value)}
            />
            <Input
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={form.password_confirmation}
              onChange={(e) => set('password_confirmation', e.target.value)}
            />
          </FormCluster>
        </FormSection>

        <FormFooter
          cancelHref="/"
          loading={save.isPending}
          showAiTranslate={false}
        />
      </form>
    </div>
  );
}
