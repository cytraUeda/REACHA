'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../lib/api';

type RunStatusResponse = {
  status: 'running' | 'idle' | 'error';
  company: string | null;
  jobId: string | null;
  progress: { completed: number; total: number } | null;
};

type ToastState = {
  company: string;
} | null;

export function JobStatusBar() {
  const [status, setStatus] = useState<RunStatusResponse | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const prevStatus = useRef<RunStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await apiGet<RunStatusResponse>('/api/run/status');
        if (cancelled) return;

        // 完了トリガー検知: running -> idle/error
        if (prevStatus.current && prevStatus.current.status === 'running' && res.status !== 'running') {
          const company = prevStatus.current.company;
          if (company) {
            setToast({ company });
            setTimeout(() => {
              setToast((current) => (current && current.company === company ? null : current));
            }, 8000);
          }
        }

        prevStatus.current = res;
        setStatus(res);
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      }
    }

    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const bar =
    !status || status.status === 'idle' ? (
      <div className="job-bar job-bar-idle">
        <span className="dot dot-idle" />
        <span className="muted" style={{ fontSize: 12 }}>
          実行中のジョブはありません。
        </span>
      </div>
    ) : (
      <div className="job-bar job-bar-running">
        <span className="dot dot-running" />
        <span style={{ fontSize: 12 }}>
          実行中: <strong>{status.company}</strong>
        </span>
        {status.progress && status.progress.total > 0 && (
          <span className="job-progress" style={{ fontSize: 12 }}>
            {status.progress.completed} / {status.progress.total}
          </span>
        )}
        {status.company && (
          <Link
            href={`/company/${encodeURIComponent(status.company)}`}
            className="app-nav-item"
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            会社ページへ
          </Link>
        )}
      </div>
    );

  return (
    <>
      {bar}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 56,
            right: 16,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              padding: 10,
              maxWidth: 260,
              fontSize: 12,
            }}
          >
            <div style={{ marginBottom: 4 }}>ジョブが完了しました: {toast.company}</div>
            <Link
              href={`/company/${encodeURIComponent(toast.company)}`}
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '6px 10px' }}
            >
              結果を見る
            </Link>
          </div>
        </div>
      )}
    </>
  );
}


