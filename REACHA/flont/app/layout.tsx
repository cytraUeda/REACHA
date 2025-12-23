import './globals.css';
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { RecentCompaniesSidebar } from '../components/RecentCompaniesSidebar';
import { JobStatusBar } from '../components/JobStatusBar';

export const metadata: Metadata = {
  title: 'REACHA - Company Reports',
  description: 'Dify-run company reports viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-root">
          <aside className="app-sidebar">
            <div className="app-sidebar-header">
              <Link href="/" className="app-logo">
                REACHA
              </Link>
            </div>
            <RecentCompaniesSidebar />
          </aside>
          <div className="app-main">
            <header className="app-header">
              <JobStatusBar />
            </header>
            <main className="app-content">{children}</main>
            <footer className="app-footer">
              <span className="muted" style={{ fontSize: 11 }}>
                長時間のリサーチ／提案作成はバックグラウンドで継続されます。
              </span>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}

