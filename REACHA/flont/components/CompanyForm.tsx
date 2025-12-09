'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../lib/api';

const DEFAULT_QUERIES = [
  '事業の全体像',
  '外部環境と市場評価',
  '競争優位と差別化要因',
  '直近のニュース取得',
  '世間の評価',
];

export default function CompanyForm() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [company, setCompany] = useState('');
  const [selected, setSelected] = useState<string[]>([...DEFAULT_QUERIES]);
  const [submitting, setSubmitting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    apiGet<{ companies: string[] }>(`/api/companies`).then((r) => setCompanies(r.companies)).catch(() => {});
  }, []);

  function toggleQuery(q: string) {
    setSelected((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]));
  }

  function selectAll() {
    setSelected([...DEFAULT_QUERIES]);
  }

  function clearAll() {
    setSelected([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSubmitting(true);
    try {
      await apiPost(`/api/run`, { company, queries: selected });
      router.push(`/company/${encodeURIComponent(company)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="inputRow">
        <input
          list="companyList"
          placeholder="会社名を入力"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <datalist id="companyList">
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <button
          type="button"
          className={`tab ${showOptions ? 'active' : ''}`}
          aria-expanded={showOptions}
          onClick={() => setShowOptions((v) => !v)}
          title="オプション設定"
        >
          オプション ({selected.length}/5)
        </button>

        <button type="submit" disabled={submitting || !company} className="btn btn-primary">
          {submitting ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="spinner" />実行中…</span>) : '実行'}
        </button>
      </div>

      {showOptions && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="card-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <strong>実行対象</strong>
              <span className="muted">({selected.length}/5 選択) 未選択の場合は全件実行されます</span>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost" onClick={selectAll}>全選択</button>
              <button type="button" className="btn btn-ghost" onClick={clearAll}>全解除</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {DEFAULT_QUERIES.map((q) => (
                <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(q)}
                    onChange={() => toggleQuery(q)}
                  />
                  <span>{q}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}


