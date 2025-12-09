'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, ResultsResponse } from '../../../lib/api';
import Markdown from '../../../components/Markdown';
import { Tabs } from '../../../components/Tabs';

export default function CompanyClient({ company }: { company: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [active, setActive] = useState('1');

  async function load() {
    try {
      const res = await apiGet<ResultsResponse>(`/api/results/${encodeURIComponent(company)}`);
      setData(res);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [company]);

  const tabs = (data?.queries || []).slice(0, 5).map((q, idx) => ({ key: String(idx + 1), label: q }));
  const activeIndex = Number(active) - 1;
  const item = data?.items?.[activeIndex];
  const isRunning = data?.status === 'running';
  
  // Show proposal button if there's at least one result file (for proposal creation)
  const hasResults = data?.items?.some(item => (item.text && item.text.trim()) || (item.markdown && item.markdown.trim())) || false;
  const canCreateProposal = !isRunning && hasResults;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{company}</h1>
        {canCreateProposal && (
          <button 
            className="btn" 
            onClick={() => router.push(`/company/${encodeURIComponent(company)}/proposal`)}
            style={{ marginLeft: 'auto' }}
          >
            提案を作成
          </button>
        )}
      </div>
      {data?.progress && (
        <p className="muted">進捗: {data.progress.completed} / {data.progress.total}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isRunning && <div className="spinner" />}
        <span>{isRunning ? '実行中… 完了までしばらくお待ちください。' : (data?.status === 'completed' ? '完了' : '未実行')}</span>
      </div>

      <div style={{ height: 12 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="btn" onClick={() => router.push('/')}>← 戻る</button>
      </div>

      {tabs.length > 0 && (
        <Tabs tabs={tabs} active={active} onChange={setActive} />
      )}

      {item && (
        <div>
          <Markdown content={item.markdown || item.text || ''} />
        </div>
      )}
    </div>
  );
}


