import type { Metadata } from 'next';
import ThemeRegistry from './theme-registry';

export const metadata: Metadata = {
  title: 'Nimbus Ops Dashboard',
  description: 'Offline-capable operations dashboard for a startup team.',
  manifest: '/manifest.webmanifest'
};

export const viewport = {
  themeColor: '#0b0f14'
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
