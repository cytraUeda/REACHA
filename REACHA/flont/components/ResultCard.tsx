'use client';

import React from 'react';
import { ResultsItem } from '../lib/api';
import Markdown from './Markdown';

type Props = {
  item: ResultsItem;
  onClick: () => void;
};

export default function ResultCard({ item, onClick }: Props) {
  const content = item.markdown || item.text || '';
  const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
  const hasMore = content.length > 500;

  return (
    <div
      className="card"
      style={{
        padding: 20,
        marginBottom: 16,
        cursor: 'pointer',
        transition: 'transform 0.1s ease, box-shadow 0.2s ease',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(2,6,23,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{item.title}</h3>
          {item.edited && <span className="pill pill-success">編集あり</span>}
          {!item.edited && content && <span className="pill">未編集</span>}
          {item.historyCount ? <span className="pill pill-ghost">履歴 {item.historyCount}</span> : null}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '14px' }}>クリックして編集 →</span>
      </div>

      <div
        className="markdown-content"
        style={{
          maxHeight: '200px',
          overflow: 'hidden',
          position: 'relative',
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        <Markdown content={preview} />
        {hasMore && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60px',
              background: 'linear-gradient(to bottom, transparent, var(--card))',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {hasMore && (
        <p style={{ margin: '12px 0 0 0', color: 'var(--muted)', fontSize: '13px', textAlign: 'center' }}>
          続きを読むにはクリックしてください
        </p>
      )}
    </div>
  );
}

