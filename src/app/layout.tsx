import type { Metadata } from 'next';
import ThemeRegistry from './theme-registry';

export const metadata: Metadata = {
  title: 'Value-Driven Trading Advisor',
  description: 'Revolut-style free-tier trading and learning sandbox deployed on GitHub Pages.',
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
