'use client';

import React from 'react';
import Markdown from './Markdown';

// Client 側で定義されている構造と互換の簡易型
export type ProposalRunForCompare = {
  提案テーマ一覧?: {
    順位?: number;
    タイトル?: string | null;
    課題仮説?: string | null;
  }[];
  提案全体の戦略サマリー?: Record<string, unknown>;
};

type Props = {
  runs: ProposalRunForCompare[];
};

function pickTheme(run: ProposalRunForCompare, rank: number): string {
  const list = run.提案テーマ一覧 || [];
  const byRank = list.find((t) => t.順位 === rank) || list[rank - 1];
  const text = byRank?.タイトル || byRank?.課題仮説 || '';
  return text || '';
}

function pickSummaryField(run: ProposalRunForCompare, key: string): string {
  const summary = run.提案全体の戦略サマリー || {};
  const value = summary[key];
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function ProposalComparisonTable({ runs }: Props) {
  if (!runs.length) return null;

  const rows: {
    id: string;
    label: string;
    getter: (run: ProposalRunForCompare) => string;
  }[] = [
    {
      id: 'theme1',
      label: '提案テーマ（1位）',
      getter: (run) => pickTheme(run, 1),
    },
    {
      id: 'theme2',
      label: '提案テーマ（2位）',
      getter: (run) => pickTheme(run, 2),
    },
    {
      id: 'win',
      label: 'この企業における勝ち筋',
      getter: (run) => pickSummaryField(run, 'この企業における勝ち筋'),
    },
    {
      id: 'persona',
      label: '最優先で接触すべき部門・キーパーソン像',
      getter: (run) =>
        pickSummaryField(run, '最優先で接触すべき部門_キーパーソン像'),
    },
    {
      id: 'risk',
      label: '潜在リスクと打ち手',
      getter: (run) => pickSummaryField(run, '潜在リスクと打ち手'),
    },
  ];

  return (
    <div className="proposal-compare-wrapper">
      <table className="proposal-compare-table">
        <thead>
          <tr>
            <th style={{ minWidth: 220 }}>項目</th>
            {runs.map((_, idx) => (
              <th key={idx} style={{ minWidth: 260 }}>
                第{idx + 1}回
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="proposal-compare-row-header">{row.label}</th>
              {runs.map((run, idx) => {
                const content = row.getter(run);
                return (
                  <td key={idx}>
                    {content ? (
                      <Markdown content={content} />
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        (未記載)
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


