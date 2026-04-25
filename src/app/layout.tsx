import type { Metadata, Viewport } from 'next';
import ThemeRegistry from './theme-registry';

export const metadata: Metadata = {
  title: 'Agentic Trading Control Center',
  description: 'Transparent AI-assisted trading simulation platform with realtime decisions, execution telemetry, and portfolio analytics.',
  applicationName: 'Agentic Trading Control Center',
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
    title: 'Agentic Trading Control Center',
    description: 'AI-assisted trading simulator with full decision and execution transparency.',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Agentic Trading Control Center',
    description: 'Realtime AI trading observability dashboard and simulation engine.'
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
