import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';
import { MetaPixel } from '@/components/MetaPixel';
import { RegistrationTracker } from '@/components/RegistrationTracker';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aicreative.kz';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AICreative — ИИ-генератор рекламных креативов для Instagram, TikTok и Kaspi',
    template: '%s | AICreative',
  },
  description: 'ИИ создаёт продающие видео и статичные креативы для таргета за 60 секунд. Без дизайнера, без съёмок. +47% CTR в среднем. 7 импульсов бесплатно.',
  keywords: [
    'генератор креативов',
    'AI реклама',
    'креативы Instagram',
    'креативы TikTok',
    'креативы Kaspi',
    'таргет Казахстан',
    'Reels генератор',
    'ИИ дизайн',
  ],
  authors: [{ name: 'AICreative' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'AICreative',
    statusBarStyle: 'black-translucent',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_KZ',
    url: SITE_URL,
    siteName: 'AICreative',
    title: 'AICreative — ИИ-генератор продающих креативов',
    description: 'За 60 секунд ИИ собирает видео/статику с CTR до 47%. Без дизайнера и съёмок. 7 импульсов бесплатно.',
    images: [
      {
        url: '/hero_visual_light.png',
        width: 1200,
        height: 630,
        alt: 'AICreative — интерфейс генератора',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AICreative — ИИ-генератор креативов',
    description: 'ИИ собирает конверсионные креативы за 60 секунд. 7 импульсов бесплатно.',
    images: ['/hero_visual_light.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#fdfcfb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Clerk modal/components are rendered in Russian. `ruRU` ships with
    // Clerk's localizations package and covers every string the prebuilt
    // SignIn/SignUp flows render — sign-in title, OAuth button labels,
    // email/password fields, error messages, account portal, etc.
    <ClerkProvider localization={ruRU}>
      <html lang="ru">
        <body className={`${inter.variable} font-sans antialiased`}>
          {/* Meta Pixel — global base script + SPA-aware PageView tracker */}
          <MetaPixel />
          {/* Fires `CompleteRegistration` exactly once when a freshly-signed
              up Clerk user lands on any page. Mounted here so it covers the
              full app (users often land on /editor right after Clerk's
              redirect). */}
          <RegistrationTracker />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
