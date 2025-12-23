'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'reacha_recent_companies';
const MAX_ITEMS = 5;

export function RecentCompaniesSidebar() {
  const [companies, setCompanies] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCompanies(parsed.filter((c) => typeof c === 'string' && c.trim()).slice(0, MAX_ITEMS));
      }
    } catch {
      // ignore
    }
  }, []);

  if (!companies.length) {
    return (
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        最近開いた会社はまだありません。
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>最近の会社</div>
      <nav className="app-nav">
        {companies.map((c) => (
          <Link
            key={c}
            href={`/company/${encodeURIComponent(c)}`}
            className="app-nav-item"
          >
            {c}
          </Link>
        ))}
      </nav>
    </div>
  );
}


