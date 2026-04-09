import type { Metadata } from 'next';
import ThemeRegistry from './theme-registry';

export const metadata: Metadata = {
  title: 'Live Trading Control Center',
  description: 'Realtime trading operations dashboard focused on wheel state, server events, risk and executions.',
  manifest: 'manifest.webmanifest'
};

export const viewport = {
  themeColor: '#e2e8f0'
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
