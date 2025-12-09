'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, ResultsItem, ResultsResponse } from '../../../lib/api';
import EditableSection from '../../../components/EditableSection';

export default function CompanyClient({ company }: { company: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await apiGet<ResultsResponse>(`/api/results/${encodeURIComponent(company)}`);
      setData(res);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [company]);

  const isRunning = data?.status === 'running';
  const hasResults = data?.items?.some((i) => (i.text && i.text.trim()) || (i.markdown && i.markdown.trim())) || false;
  const canCreateProposal = !isRunning && hasResults;

  const handleRerun = useCallback(
    async (idx: number) => {
      setLoading(true);
      setError(null);
      try {
        await apiPost(`/api/results/${encodeURIComponent(company)}/${idx}/rerun`, {});
      } catch (e) {
        if (e instanceof Error) setError(e.message);
      } finally {
        setLoading(false);
        load();
      }
    },
    [company]
  );

  const handleSaved = useCallback(() => {
    load();
  }, [company]);

  return (
    <div className="container">
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>{company}</h1>
          {isRunning && <span className="pill">実行中</span>}
          {!isRunning && data?.status === 'completed' && <span className="pill pill-success">完了</span>}
          {!isRunning && data?.status === 'not_found' && <span className="pill">未実行</span>}
        </div>
        {data?.progress && (
          <p className="muted" style={{ margin: 0 }}>
            進捗: {data.progress.completed} / {data.progress.total}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => router.push('/')}>← 戻る</button>
          {canCreateProposal && (
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/company/${encodeURIComponent(company)}/proposal`)}
            >
              提案を作成
            </button>
          )}
          {data?.hasProposal && (
            <button
              className="btn"
              onClick={() => router.push(`/company/${encodeURIComponent(company)}/proposal`)}
            >
              提案を見る
            </button>
          )}
        </div>
        {(isRunning || loading) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="spinner" />
            <span>バックグラウンドで処理中です…</span>
          </div>
        )}
        {error && <div className="alert">{error}</div>}
      </div>

      {data?.items?.length ? (
        data.items.map((item: ResultsItem) => (
          <EditableSection
            key={item.index}
            company={company}
            item={item}
            isRunning={Boolean(isRunning)}
            onSaved={handleSaved}
            onRerun={handleRerun}
          />
        ))
      ) : (
        <p className="muted">結果がありません。</p>
      )}
    </div>
  );
}