'use client';

import React from 'react';
import type { ProposalKeyword } from './ProposalKeywordGraph';

type Props = {
  keywords: ProposalKeyword[];
  selectedTerm?: string | null;
  onSelectTerm?: (term: string | null) => void;
};

export default function ProposalKeywordTable({ keywords, selectedTerm, onSelectTerm }: Props) {
  return (
    <div className="card" style={{ padding: 12, minHeight: 280 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>上位キーワード</h2>
      <p className="muted" style={{ margin: '4px 0 8px', fontSize: 12 }}>
        スコアは頻度と重要度から算出した相対値です。
      </p>
      {keywords.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          表示できるキーワードがまだありません。
        </p>
      ) : (
        <div style={{ maxHeight: 240, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>キーワード</th>
                <th style={{ width: 80 }}>スコア</th>
                <th style={{ width: 80 }}>出現</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k, idx) => {
                const isSelected = selectedTerm === k.term;
                return (
                  <tr
                    key={k.term}
                    onClick={() => onSelectTerm?.(isSelected ? null : k.term)}
                    style={{
                      cursor: onSelectTerm ? 'pointer' : 'default',
                      backgroundColor: isSelected ? 'var(--bg-subtle)' : undefined,
                    }}
                  >
                    <td>{idx + 1}</td>
                    <td>{k.term}</td>
                    <td>{k.score.toFixed(2)}</td>
                    <td>{k.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


