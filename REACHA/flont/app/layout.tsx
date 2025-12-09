import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'REACHA - Company Reports',
  description: 'Dify-run company reports viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}


