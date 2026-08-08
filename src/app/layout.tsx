import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Be_Vietnam_Pro, Fraunces, Nunito } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/app.scss';

const nunito = Nunito({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ViTravel Admin',
    template: '%s · ViTravel Admin',
  },
  description: 'Hệ thống quản trị ViTravel — quản lý tour, nội dung và vận hành.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${nunito.variable} ${beVietnam.variable} ${fraunces.variable}`}>
      <body
        style={
          {
            '--admin-font-sans':
              'var(--font-be-vietnam), var(--font-nunito), system-ui, sans-serif',
            '--admin-font-display': 'var(--font-fraunces), Georgia, serif',
          } as CSSProperties
        }
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
