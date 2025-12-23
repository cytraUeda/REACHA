'use client';

import React, { useState } from 'react';
import Markdown from './Markdown';

// Client 側の ParsedProposalRun と構造互換な簡易型
export type ProposalRunForTabs = {
  source_query_index?: number;
  source_query_label?: string | null;
  提案テーマ一覧?: {
    順位?: number;
    タイトル?: string | null;
    課題仮説?: string | null;
  }[];
  提案全体の戦略サマリー?: Record<string, unknown>;
  _raw?: string;
};

export type ProposalViewMode = 'single' | 'compare';

type Props = {
  runs: ProposalRunForTabs[];
  activeIndex: number;
  mode: ProposalViewMode;
  onChangeIndex: (index: number) => void;
  onChangeMode: (mode: ProposalViewMode) => void;
};

export default function ProposalRunTabs({
  runs,
  activeIndex,
  mode,
  onChangeIndex,
  onChangeMode,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!runs.length) return null;

  return (
    <div>
      <div className="tabs" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {runs.map((run, idx) => {
          const active = mode === 'single' && idx === activeIndex;
          const sourceLabel =
            (typeof run.source_query_label === 'string' && run.source_query_label.trim()) ||
            undefined;
          const baseLabel = sourceLabel
            ? `${sourceLabel}に基づく提案`
            : `提案 Ver.${idx + 1}`;
          // ボタン自体が縦に伸びすぎないよう、表示用ラベルは適度にトリミング
          const MAX_BASE_LABEL_LENGTH = 20;
          const displayBaseLabel =
            baseLabel.length > MAX_BASE_LABEL_LENGTH
              ? `${baseLabel.slice(0, MAX_BASE_LABEL_LENGTH)}…`
              : baseLabel;
          const titleCandidate =
            run.提案テーマ一覧?.find((t) => t.順位 === 1) || run.提案テーマ一覧?.[0];
          const subtitle =
            titleCandidate?.タイトル || titleCandidate?.課題仮説 || '';
          return (
            <button
              key={idx}
              type="button"
              className={`tab ${active ? 'active' : ''}`}
              onClick={() => onChangeIndex(idx)}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() =>
                setHoverIndex((prev) => (prev === idx ? null : prev))
              }
              title={baseLabel}
            >
              <span
                style={{
                  display: 'block',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayBaseLabel}
              </span>
              {subtitle && (
                <span
                  className="muted"
                  style={{
                    fontSize: 11,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {subtitle}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className={`tab ${mode === 'compare' ? 'active' : ''}`}
          onClick={() => onChangeMode('compare')}
        >
          全回比較
        </button>
      </div>

      {mode === 'single' &&
        hoverIndex != null &&
        hoverIndex >= 0 &&
        hoverIndex < runs.length && (
          <div className="card" style={{ padding: 12, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              ホバー中: {(runs[hoverIndex].source_query_label || `提案 Ver.${hoverIndex + 1}`) as string}
            </div>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              <Markdown content={runs[hoverIndex]._raw || ''} />
            </div>
          </div>
        )}
    </div>
  );
}


