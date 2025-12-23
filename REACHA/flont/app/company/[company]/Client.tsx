'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, ResultsItem, ResultsResponse } from '../../../lib/api';
import ResultCard from '../../../components/ResultCard';
import EditModal from '../../../components/EditModal';

export default function CompanyClient({ company }: { company: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    // 最近開いた会社をローカルに記録
    if (typeof window !== 'undefined') {
      try {
        const key = 'reacha_recent_companies';
        const raw = window.localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        const filtered = Array.isArray(list) ? list.filter((c) => c !== company) : [];
        filtered.unshift(company);
        window.localStorage.setItem(key, JSON.stringify(filtered.slice(0, 5)));
      } catch {
        // ignore
      }
    }

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
  }, []);

  const handleCardClick = useCallback((item: ResultsItem) => {
    setEditingIndex(item.index);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const editingItem = editingIndex !== null ? data?.items?.find((item) => item.index === editingIndex) : null;

  return (
    <div className="container">
      <div className="card" style={{ padding: 20, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>{company}</h1>
          {isRunning && <span className="pill">実行中</span>}
          {!isRunning && data?.status === 'completed' && <span className="pill pill-success">完了</span>}
          {!isRunning && data?.status === 'not_found' && <span className="pill">未実行</span>}
        </div>
        {data?.progress && (
          <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
            進捗: {data.progress.completed} / {data.progress.total}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <>
          <div style={{ marginBottom: 8 }}>
            <p className="muted" style={{ fontSize: '14px', margin: 0 }}>
              調査結果をクリックして編集できます
            </p>
          </div>
          {data.items.map((item: ResultsItem) => (
            <ResultCard key={item.index} item={item} onClick={() => handleCardClick(item)} />
          ))}
        </>
      ) : (
        <p className="muted">結果がありません。</p>
      )}

      {editingItem && (
        <EditModal
          company={company}
          item={editingItem}
          isRunning={Boolean(isRunning)}
          onClose={handleCloseModal}
          onSaved={handleSaved}
          onRerun={handleRerun}
        />
      )}
    </div>
  );
}