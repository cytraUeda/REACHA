'use client';

import React, { useState } from 'react';

type Props = {
  rawText: string;
  blocks: string[];
  parseErrors: string[];
};

export default function ProposalJsonDebugPanel({
  rawText,
  blocks,
  parseErrors,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" style={{ padding: 12 }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        style={{ marginBottom: open ? 12 : 0 }}
      >
        生JSONを{open ? '閉じる' : '確認する（開発者向け）'}
      </button>
      {open && (
        <div
          className="grid-2col"
          style={{ gap: 12, alignItems: 'flex-start', marginTop: 4 }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              解析対象テキスト
            </div>
            <textarea
              readOnly
              value={rawText}
              style={{
                width: '100%',
                minHeight: 200,
                fontFamily: 'monospace',
                fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              検出されたJSONブロック / エラー
            </div>
            <div style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>
              {blocks.map((b, idx) => (
                <details key={idx} style={{ marginBottom: 4 }}>
                  <summary>ブロック {idx + 1}</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{b}</pre>
                </details>
              ))}
              {parseErrors.length > 0 && (
                <>
                  <div style={{ marginTop: 8, fontWeight: 600 }}>パースエラー</div>
                  <ul>
                    {parseErrors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


