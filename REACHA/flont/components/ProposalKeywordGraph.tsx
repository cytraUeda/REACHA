'use client';

import React, { useMemo, useState } from 'react';

export type ProposalKeyword = {
  term: string;
  score: number;
  count: number;
  x?: number;
  y?: number;
  category?: string | null;
};

export type ProposalEdge = {
  source: string;
  target: string;
  weight: number;
};

type Props = {
  keywords: ProposalKeyword[];
  edges: ProposalEdge[];
  selectedTerm?: string | null;
  onSelectTerm?: (term: string | null) => void;
};

type PositionedNode = ProposalKeyword & {
  x: number;
  y: number;
};

export default function ProposalKeywordGraph({
  keywords,
  edges,
  selectedTerm,
  onSelectTerm,
}: Props) {
  const [scale, setScale] = useState(1.2);

  const nodes: PositionedNode[] = useMemo(() => {
    if (!keywords.length) return [];
    const maxScore = Math.max(...keywords.map((k) => k.score || 0.0001));
    const hasCoords = keywords.every((k) => typeof k.x === 'number' && typeof k.y === 'number');
    const centerX = 320;
    const centerY = 220;
    const radius = 200;

    if (hasCoords) {
      // サーバーから渡された 0〜1 座標を SVG 座標にマッピング
      return keywords.map((k) => {
        const nx = typeof k.x === 'number' ? k.x : 0.5;
        const ny = typeof k.y === 'number' ? k.y : 0.5;
        const x = 40 + nx * 560;
        const y = 40 + ny * 360;
        return { ...k, x, y };
      });
    }

    // フォールバック: 従来の円形レイアウト
    return keywords.map((k, idx) => {
      if (idx === 0) {
        return { ...k, x: centerX, y: centerY };
      }
      const angle = (2 * Math.PI * (idx - 1)) / Math.max(1, keywords.length - 1);
      const r = radius * (0.6 + 0.4 * (k.score / maxScore));
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return { ...k, x, y };
    });
  }, [keywords]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    nodes.forEach((n) => map.set(n.term, n));
    return map;
  }, [nodes]);

  const hasData = nodes.length > 0;

  return (
    <div className="card" style={{ padding: 12, minHeight: 380 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>キーワードネットワーク</h2>
          <p className="muted" style={{ margin: '4px 0 8px', fontSize: 12 }}>
            提案テキスト内の頻出キーワードと共起関係をざっくり可視化しています。
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span className="muted">図のスケール</span>
          <input
            type="range"
            min={0.8}
            max={1.8}
            step={0.1}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </div>
      </div>
      {!hasData ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          表示できるキーワードがまだありません。
        </p>
      ) : (
        <svg
          width="100%"
          height={440}
          viewBox="0 0 640 420"
          style={{ overflow: 'visible', cursor: 'default' }}
        >
          <g transform={`scale(${scale})`}>
            {/* edges */}
            {edges.map((e, idx) => {
              const a = nodeMap.get(e.source);
              const b = nodeMap.get(e.target);
              if (!a || !b) return null;
              const isHighlighted =
                selectedTerm && (e.source === selectedTerm || e.target === selectedTerm);
              const baseOpacity = isHighlighted ? 0.9 : 0.35;
              const strokeWidth = 0.4 + 2.2 * e.weight;
              return (
                <line
                  key={idx}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--border)"
                  strokeWidth={strokeWidth}
                  opacity={baseOpacity}
                />
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const maxScore = Math.max(...keywords.map((k) => k.score || 0.0001));
              const baseR = 6 + 10 * (n.score / maxScore);
              const isSelected = selectedTerm === n.term;
              return (
                <g
                  key={n.term}
                  onClick={() => onSelectTerm?.(isSelected ? null : n.term)}
                  style={{ cursor: onSelectTerm ? 'pointer' : 'default' }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={baseR}
                    fill={isSelected ? 'var(--primary)' : 'var(--bg-subtle)'}
                    stroke={isSelected ? 'var(--primary-strong)' : 'var(--border)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={n.x}
                    y={n.y - (baseR + 4)}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text)"
                  >
                    {n.term}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}


