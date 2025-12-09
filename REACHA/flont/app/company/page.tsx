"use client";
import { useEffect, useMemo, useState } from 'react';
import CompanyClient from './[company]/Client';

export default function CompanyPageClient() {
  const [company, setCompany] = useState<string>("");

  useEffect(() => {
    try {
      const path = window.location.pathname; // e.g. /company/凸版
      const seg = path.split("/").filter(Boolean);
      const idx = seg.findIndex((s) => s === "company");
      const name = idx >= 0 && seg[idx + 1] ? decodeURIComponent(seg[idx + 1]) : "";
      setCompany(name);
    } catch {
      setCompany("");
    }
  }, []);

  if (!company) {
    return (
      <div className="container">
        <h1>会社の選択が必要です</h1>
        <p className="muted">トップページから会社名を入力してください。</p>
      </div>
    );
  }

  return <CompanyClient company={company} />;
}


