'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../../../lib/api';
import Markdown from '../../../../components/Markdown';

type ProposalResponse = {
  proposal: string;
};

type ProgressResponse = {
  current: number;
  total: number;
  status: string;
};

export default function ProposalClient({ company }: { company: string }) {
  const router = useRouter();
  const [proposal, setProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchProposal = useCallback(async (isRetry = false, signal?: AbortSignal) => {
    try {
      if (!isRetry) {
        setLoading(true);
      }
      setError(null);
      setProgress(null);
      
      let progressInterval: NodeJS.Timeout | null = null;
      let postAbortController: AbortController | null = null;
      let proposalCompleted = false;
      
      // Start progress polling
      progressInterval = setInterval(async () => {
        if (signal?.aborted) {
          if (progressInterval) clearInterval(progressInterval);
          return;
        }
        try {
          const progressRes = await apiGet<ProgressResponse>(
            `/api/proposal/${encodeURIComponent(company)}/progress`
          );
          if (!signal?.aborted) {
            if (progressRes.current > 0) {
              setProgress({ current: progressRes.current, total: progressRes.total });
            }
            // Check if proposal is completed (progress file doesn't exist or status is completed)
            // If progress file doesn't exist, it means the proposal creation is done
            if (progressRes.status === 'idle' || progressRes.status === 'completed' || 
                (progressRes.current === progressRes.total && progressRes.total > 0)) {
              // Wait a bit more to ensure backend has finished writing the file
              await new Promise(resolve => setTimeout(resolve, 1000));
              // Check if proposal file exists now
              try {
                const proposalRes = await apiPost<ProposalResponse>(
                  `/api/proposal/${encodeURIComponent(company)}`,
                  {},
                  { timeout: 10000 } // Short timeout for cached proposal
                );
                if (!signal?.aborted && proposalRes.proposal) {
                  setProposal(proposalRes.proposal);
                  setProgress(null);
                  setRetryCount(0);
                  setLoading(false);
                  proposalCompleted = true;
                  if (postAbortController) {
                    postAbortController.abort();
                  }
                  if (progressInterval) {
                    clearInterval(progressInterval);
                  }
                }
              } catch (e) {
                // If proposal file doesn't exist yet, continue waiting
                console.debug('Proposal not ready yet, continuing to wait...');
              }
            }
          }
        } catch (e) {
          // Ignore progress polling errors
        }
      }, 2000); // Poll every 2 seconds
      
      // Start the POST request (this may take a long time)
      postAbortController = new AbortController();
      try {
        const res = await apiPost<ProposalResponse>(
          `/api/proposal/${encodeURIComponent(company)}`,
          {},
          { timeout: 1200000, signal: postAbortController.signal } // 20 minutes timeout
        );
        if (!signal?.aborted && !proposalCompleted) {
          setProposal(res.proposal);
          setProgress(null);
          setRetryCount(0);
        }
      } catch (e) {
        // If aborted by progress polling, don't show error
        if (!signal?.aborted && !proposalCompleted) {
          const errorMessage = e instanceof Error ? e.message : '提案の作成に失敗しました';
          // Don't show timeout error if proposal was completed via progress polling
          if (!errorMessage.includes('タイムアウト') || !proposalCompleted) {
            console.error('Proposal creation error:', e);
            setError(errorMessage);
            setProgress(null);
          }
        }
      }
      
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    } catch (e) {
      if (!signal?.aborted) {
        const errorMessage = e instanceof Error ? e.message : '提案の作成に失敗しました';
        console.error('Proposal creation error:', e);
        setError(errorMessage);
        setProgress(null);
      }
    } finally {
      if (!signal?.aborted && !proposalCompleted) {
        setLoading(false);
      }
    }
  }, [company]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchProposal(false, abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchProposal]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    fetchProposal(true);
  }, [fetchProposal]);

  return (
    <div className="container">
      <h1>{company} - 提案</h1>

      <div style={{ height: 12 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn" onClick={() => router.push(`/company/${encodeURIComponent(company)}`)}>
          ← 戻る
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
          <div className="spinner" />
          <p className="muted">
            提案を作成中...
            {progress && (
              <span style={{ display: 'block', marginTop: 8, fontSize: '0.9em' }}>
                {progress.current} / {progress.total}
              </span>
            )}
          </p>
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#c00', marginBottom: 12 }}>エラー: {error}</p>
          <button 
            className="btn" 
            onClick={handleRetry}
            style={{ marginTop: 8 }}
          >
            再試行
          </button>
          {retryCount > 0 && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9em', color: '#666' }}>
              再試行回数: {retryCount}
            </p>
          )}
        </div>
      )}

      {!loading && !error && proposal && (
        <div>
          <Markdown content={proposal} />
        </div>
      )}
    </div>
  );
}

