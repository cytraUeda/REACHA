'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../../../lib/api';
import Markdown from '../../../../components/Markdown';
import ProposalRunTabs, { ProposalViewMode } from '../../../../components/ProposalRunTabs';
import ProposalComparisonTable from '../../../../components/ProposalComparisonTable';
import ProposalJsonDebugPanel from '../../../../components/ProposalJsonDebugPanel';
import ProposalKeywordGraph, {
  type ProposalKeyword,
  type ProposalEdge,
} from '../../../../components/ProposalKeywordGraph';
import ProposalKeywordTable from '../../../../components/ProposalKeywordTable';

type ProposalResponse = {
  proposal: string;
};

type ProgressResponse = {
  current: number;
  total: number;
  status: string;
};

// ------------------------
// JSON パース用の型・ヘルパー
// ------------------------

type ProposalTheme = {
  順位?: number;
  タイトル?: string | null;
  課題仮説?: string | null;
  解決アプローチ?: string | null;
  期待効果?: {
    定量効果?: string | null;
    定性効果?: string | null;
    [key: string]: unknown;
  } | null;
  提案メッセージ案?: {
    経営層向け?: string | null;
    現場担当者向け?: string | null;
    [key: string]: unknown;
  } | null;
  参考実績_裏付け?: string | null;
  [key: string]: unknown;
};

export type ParsedProposalRun = {
  source_query_index?: number;
  source_query_label?: string | null;
  提案テーマ一覧?: ProposalTheme[];
  提案全体の戦略サマリー?: {
    [key: string]: unknown;
  };
  評価ロジック?: {
    [key: string]: unknown;
  };
  注意点?: string | null;
  _raw?: string;
};

type ParsedProposalResult = {
  runs: ParsedProposalRun[];
  blocks: string[];
  parseErrors: string[];
};

type ProposalKeywordResponse = {
  keywords: ProposalKeyword[];
  edges: ProposalEdge[];
  meta: {
    runIndex: number;
    totalTerms: number;
    source?: string;
  };
};

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 連結された JSON テキストから {} バランスを見てブロックに分割する
 * - 文字列リテラル内の { } は無視
 * - エスケープシーケンスも考慮
 */
function splitJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      // かなり素朴な実装だが、JSON では \" がメインなのでこれで十分
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const block = text.slice(start, i + 1);
        blocks.push(block);
        start = -1;
      }
    }
  }

  return blocks;
}

function parseProposalRuns(proposalText: string | null): ParsedProposalResult {
  if (!proposalText) {
    return { runs: [], blocks: [], parseErrors: [] };
  }

  const trimmed = proposalText.trim();
  const blocks: string[] = [];
  const parseErrors: string[] = [];
  const runs: ParsedProposalRun[] = [];

  // 1) 素直な単一 JSON オブジェクトとして解釈できるか？
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const single = safeJsonParse(trimmed);
    if (single && typeof single === 'object' && !Array.isArray(single)) {
      runs.push({
        ...single,
        _raw: trimmed,
      });
      blocks.push(trimmed);
      return { runs, blocks, parseErrors };
    }
  }

  // 2) 複数 JSON オブジェクト連結としてパース
  const candidateBlocks = splitJsonBlocks(proposalText);
  for (const block of candidateBlocks) {
    const parsed = safeJsonParse(block);
    blocks.push(block);
    if (parsed && typeof parsed === 'object') {
      runs.push({
        ...parsed,
        _raw: block,
      });
    } else {
      parseErrors.push('JSON のパースに失敗しました。ブロック先頭: ' + block.slice(0, 80));
    }
  }

  return { runs, blocks, parseErrors };
}

export default function ProposalClient({ company }: { company: string }) {
  const router = useRouter();
  const [proposal, setProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeRunIndex, setActiveRunIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ProposalViewMode>('single');
  const [keywordData, setKeywordData] = useState<ProposalKeywordResponse | null>(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  // 最近開いた会社として記録（リサーチ結果ページと同じロジック）
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
  }, [company]);

  const fetchProposal = useCallback(async (isRetry = false, signal?: AbortSignal) => {
    // フラグで長時間POSTとキャッシュ取得POSTの二重発火を防ぐ
    let longPostStarted = false;
    let cacheFetchDone = false;
    let progressInterval: NodeJS.Timeout | null = null;
    let postAbortController: AbortController | null = null;
    let proposalCompleted = false;

    try {
      if (!isRetry) {
        setLoading(true);
      }
      setError(null);
      setProgress(null);
      
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
            // 提案作成が完了したと判断できる状態になったら、
            // 1回だけキャッシュ取得用の短時間POSTを試みる
            if (
              progressRes.status === 'completed' ||
              progressRes.status === 'idle' ||
              (progressRes.current === progressRes.total && progressRes.total > 0)
            ) {
              // Wait a bit more to ensure backend has finished writing the file
              await new Promise((resolve) => setTimeout(resolve, 1000));
              if (!cacheFetchDone) {
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
                    cacheFetchDone = true;
                    if (postAbortController) {
                      postAbortController.abort();
                    }
                    if (progressInterval) {
                      clearInterval(progressInterval);
                    }
                  }
                } catch (e) {
                  // If proposal file doesn't exist yet, continue waiting
                  console.debug('Proposal not ready yet, continuing to wait...', e);
                }
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
        if (!longPostStarted) {
          longPostStarted = true;
          const res = await apiPost<ProposalResponse>(
            `/api/proposal/${encodeURIComponent(company)}`,
            {},
            { timeout: 1200000, signal: postAbortController.signal } // 20 minutes timeout
          );
          if (!signal?.aborted && !proposalCompleted && res.proposal) {
            setProposal(res.proposal);
            setProgress(null);
            setRetryCount(0);
          }
        }
      } catch (e: any) {
        // If aborted by progress polling, don't show error
        if (!signal?.aborted && !proposalCompleted) {
          const status = (e as any)?.status ?? (e as any)?.response?.status;
          const errorMessage = e instanceof Error ? e.message : '提案の作成に失敗しました';
          // 409 は「既存ジョブ実行中」とみなしてエラー表示しない
          if (status === 409) {
            console.debug('Proposal already running, waiting for existing job to complete...');
          } else if (!errorMessage.includes('タイムアウト') || !proposalCompleted) {
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
    setRetryCount((prev) => prev + 1);
    fetchProposal(true);
  }, [fetchProposal]);

  const parsed = useMemo(() => parseProposalRuns(proposal), [proposal]);
  const hasJsonRuns = parsed.runs.length > 0;
  const hasParseErrors = parsed.parseErrors.length > 0;
  // 全提案回（1〜N回）をまとめたネットワークを常に表示する
  const hasKeywordNetwork = hasJsonRuns;

  const handleRefreshKeywords = useCallback(async () => {
    if (!hasKeywordNetwork) return;
    try {
      setKeywordLoading(true);
      setKeywordError(null);
      const res = await apiPost<ProposalKeywordResponse>(`/api/proposal/${encodeURIComponent(company)}/keywords/refresh?top=30`, {});
      setKeywordData(res);
    } catch (e) {
      console.error('Keyword network refresh error:', e);
      setKeywordError('キーワードネットワークの再解析に失敗しました');
    } finally {
      setKeywordLoading(false);
    }
  }, [company, hasKeywordNetwork]);

  // キーワードネットワークの取得（JSONモード single ビュー時）
  useEffect(() => {
    if (!hasKeywordNetwork) {
      setKeywordData(null);
      setKeywordError(null);
      setSelectedTerm(null);
      return;
    }
    let cancelled = false;
    async function fetchKeywords() {
      try {
        setKeywordLoading(true);
        setKeywordError(null);
        const res = await apiGet<ProposalKeywordResponse>(`/api/proposal/${encodeURIComponent(company)}/keywords?top=30`);
        if (!cancelled) {
          setKeywordData(res);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Keyword network fetch error:', e);
          setKeywordError('キーワードネットワークの取得に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setKeywordLoading(false);
        }
      }
    }
    fetchKeywords();
    return () => {
      cancelled = true;
    };
  }, [company, hasKeywordNetwork]);

  // 実行回数が変わった場合にインデックスを補正
  useEffect(() => {
    if (!parsed.runs.length) {
      setActiveRunIndex(0);
      return;
    }
    setActiveRunIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= parsed.runs.length) return parsed.runs.length - 1;
      return prev;
    });
  }, [parsed.runs.length]);

  return (
    <div className="container">
      <h1 style={{ marginTop: 0, fontSize: '24px', fontWeight: 600, marginBottom: 8 }}>{company} - 提案</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => router.push(`/company/${encodeURIComponent(company)}`)}>
          ← 戻る
        </button>
        <span className="pill pill-ghost">
          形式: {hasJsonRuns ? 'JSON（比較ビュー）' : 'Markdown（旧形式）'}
        </span>
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

      {!loading && !error && proposal && hasJsonRuns && (
        <>
          {hasParseErrors && (
            <div className="alert" style={{ marginBottom: 16 }}>
              一部のJSONブロックの読み込みに失敗しました。可能な範囲で表示しています。
            </div>
          )}

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <ProposalRunTabs
              runs={parsed.runs}
              activeIndex={activeRunIndex}
              mode={viewMode}
              onChangeIndex={(idx) => {
                setViewMode('single');
                setActiveRunIndex(idx);
              }}
              onChangeMode={(mode) => setViewMode(mode)}
            />
          </div>

          {viewMode === 'single' && parsed.runs[activeRunIndex] && (
            <div className="grid-2col" style={{ marginBottom: 16 }}>
              <div>
                <div className="card" style={{ padding: 16 }}>
                  <h2 style={{ marginTop: 0, fontSize: 18, marginBottom: 8 }}>
                    {(() => {
                      const run = parsed.runs[activeRunIndex];
                      const label =
                        (typeof run.source_query_label === 'string' &&
                          run.source_query_label.trim()) ||
                        null;
                      if (label) {
                        return `提案テーマ一覧（${label}に基づく提案）`;
                      }
                      return `提案テーマ一覧（提案 Ver.${activeRunIndex + 1}）`;
                    })()}
                  </h2>
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                    ランキング順に上位テーマを表示します。
                  </p>
                  {(parsed.runs[activeRunIndex].提案テーマ一覧 || []).length ? (
                    (parsed.runs[activeRunIndex].提案テーマ一覧 || [])
                      .slice()
                      .sort((a, b) => (a.順位 || 999) - (b.順位 || 999))
                      .slice(0, 5)
                      .map((theme, idx) => (
                        <div
                          key={idx}
                          style={{
                            borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                            paddingTop: idx === 0 ? 0 : 8,
                            marginTop: idx === 0 ? 0 : 8,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span className="pill pill-ghost">
                              {theme.順位 != null ? `第${theme.順位}位` : `#${idx + 1}`}
                            </span>
                            <strong>{theme.タイトル || 'タイトル未設定'}</strong>
                          </div>
                          {theme.課題仮説 && (
                            <div style={{ fontSize: 13 }}>
                              <Markdown content={theme.課題仮説} />
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="muted" style={{ fontSize: 13 }}>
                      テーマがまだ記載されていません。
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="card" style={{ padding: 16 }}>
                  <h2 style={{ marginTop: 0, fontSize: 18, marginBottom: 8 }}>
                    提案全体の戦略サマリー
                  </h2>
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                    勝ち筋・接触すべき部門・リスクと打ち手をまとめて確認できます。
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SectionFromSummary
                      run={parsed.runs[activeRunIndex]}
                      field="この企業における勝ち筋"
                      label="この企業における勝ち筋"
                    />
                    <SectionFromSummary
                      run={parsed.runs[activeRunIndex]}
                      field="最優先で接触すべき部門_キーパーソン像"
                      label="最優先で接触すべき部門・キーパーソン像"
                    />
                    <SectionFromSummary
                      run={parsed.runs[activeRunIndex]}
                      field="潜在リスクと打ち手"
                      label="潜在リスクと打ち手"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'compare' && <ProposalComparisonTable runs={parsed.runs} />}

          {/* キーワードネットワーク（JSONモード・singleビュー時のみ） */}
          {hasKeywordNetwork && viewMode === 'single' && (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>
                  キーフレーズ抽出: ルールベース共起ネットワーク（除外語適用）
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleRefreshKeywords}
                  disabled={keywordLoading}
                >
                  {keywordLoading ? '再解析中…' : 'キーワードを再解析'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ProposalKeywordGraph
                  keywords={keywordData?.keywords ?? []}
                  edges={keywordData?.edges ?? []}
                  selectedTerm={selectedTerm}
                  onSelectTerm={setSelectedTerm}
                />
                <ProposalKeywordTable
                  keywords={keywordData?.keywords ?? []}
                  selectedTerm={selectedTerm}
                  onSelectTerm={setSelectedTerm}
                />
              </div>
              {keywordLoading && (
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  キーワードネットワークを解析中です…（数秒かかる場合があります）
                </p>
              )}
              {keywordError && (
                <div className="alert" style={{ marginTop: 4 }}>
                  {keywordError}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ProposalJsonDebugPanel
              rawText={proposal}
              blocks={parsed.blocks}
              parseErrors={parsed.parseErrors}
            />
          </div>
        </>
      )}

      {!loading && !error && proposal && !hasJsonRuns && (
        <>
          <div className="alert" style={{ marginBottom: 16 }}>
            提案テキストをJSONとして解釈できなかったため、Markdown形式で表示しています。
          </div>
          <div className="card" style={{ padding: 24 }}>
            <Markdown content={proposal} />
          </div>
        </>
      )}
    </div>
  );
}

type SectionProps = {
  run: ParsedProposalRun;
  field: string;
  label: string;
};

function SectionFromSummary({ run, field, label }: SectionProps) {
  const summary = run.提案全体の戦略サマリー || {};
  const value = summary[field];
  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else if (value != null) {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{label}</div>
      {text ? (
        <div style={{ fontSize: 13 }}>
          <Markdown content={text} />
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          (未記載)
        </p>
      )}
    </div>
  );
}


