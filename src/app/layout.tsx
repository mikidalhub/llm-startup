import type { Metadata, Viewport } from 'next';
import ThemeRegistry from './theme-registry';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Thinking Journey',
  description: 'A beginner-friendly, step-by-step visualization of how an AI stock trading team thinks and acts.',
  applicationName: 'AI Thinking Journey',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/trading-favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/icons/trading-favicon.svg',
    apple: '/icons/trading-favicon.svg'
  },
  openGraph: {
    title: 'AI Thinking Journey',
    description: 'Understand an AI trading cycle in calm, simple, visual steps.',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'AI Thinking Journey',
    description: 'A beginner-friendly UI for understanding AI-assisted trading decisions.'
  }
};

export const viewport: Viewport = {
  themeColor: '#f7f9fc'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
