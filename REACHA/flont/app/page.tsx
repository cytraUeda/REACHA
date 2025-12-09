"use client";

import CompanyForm from '../components/CompanyForm';
import Link from 'next/link';
import { apiGet } from '../lib/api';
import CompaniesTable from '../components/CompaniesTable';
import { useEffect, useState } from 'react';

export default function Page() {
  const [companies, setCompanies] = useState<string[]>([]);
  useEffect(() => {
    apiGet<{ companies: string[] }>(`/api/companies`).then((r) => setCompanies(r.companies)).catch(() => {});
  }, []);
  return (
    <div className="container">
      <div className="card"><div className="card-inner">
        <h1 style={{ marginTop: 0 }}>会社レポート</h1>
        <p className="muted">会社名を入力して実行、または既存結果を表示します。</p>
        <CompanyForm />
      </div></div>

      <div style={{ height: 16 }} />
      <div className="card"><div className="card-inner">
        <h2 style={{ marginTop: 0 }}>過去の結果</h2>
        <CompaniesTable companies={companies} />
      </div></div>
    </div>
  );
}


