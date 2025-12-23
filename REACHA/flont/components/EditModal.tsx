'use client';

import React, { useEffect, useState } from 'react';
import { apiPost, ResultsItem } from '../lib/api';
import DiffView from './DiffView';
import Markdown from './Markdown';

type Props = {
  company: string;
  item: ResultsItem;
  isRunning: boolean;
  onClose: () => void;
  onSaved: () => void;
  onRerun: (idx: number) => Promise<void>;
};

export default function EditModal({ company, item, isRunning, onClose, onSaved, onRerun }: Props) {
  const [value, setValue] = useState(item.markdown || item.text || '');
  const [preview, setPreview] = useState(item.markdown || item.text || '');
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    const v = item.markdown || item.text || '';
    setValue(v);
    setPreview(v);
  }, [item.index, item.markdown, item.text]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/api/results/${encodeURIComponent(company)}/${item.index}/edit`, {
        text: value,
        markdown: value,
      });
      setPreview(value);
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRerun() {
    if (!confirm('この調査結果を再実行しますか？現在の編集内容は失われます。')) {
      return;
    }
    setRerunning(true);
    setError(null);
    try {
      await onRerun(item.index);
      onClose();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setRerunning(false);
    }
  }

  function handleResetToOriginal() {
    if (!confirm('元の内容に戻しますか？現在の編集内容は失われます。')) {
      return;
    }
    const orig = item.originalMarkdown || item.originalText || '';
    setValue(orig);
    setPreview(orig);
  }

  const hasChanges = value !== (item.originalMarkdown || item.originalText || '');

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{item.title}</h2>
            {item.edited && <span className="pill pill-success">編集あり</span>}
            {item.historyCount ? <span className="pill pill-ghost">履歴 {item.historyCount}</span> : null}
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '8px 12px', fontSize: '18px', lineHeight: 1 }}
            title="閉じる (ESC)"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleResetToOriginal} disabled={saving || rerunning || isRunning || !hasChanges}>
            元に戻す
          </button>
          <button className="btn" onClick={handleRerun} disabled={saving || rerunning || isRunning}>
            {rerunning ? '再実行中…' : '再実行'}
          </button>
          <button
            className="btn"
            onClick={() => setShowDiff(!showDiff)}
            disabled={saving || rerunning}
          >
            {showDiff ? '差分を隠す' : '差分を表示'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose} disabled={saving || rerunning}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || rerunning || !hasChanges}>
            {saving ? '保存中…' : '保存して閉じる'}
          </button>
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {showDiff && (
          <div style={{ marginBottom: 16 }}>
            <DiffView original={item.originalMarkdown || item.originalText || ''} edited={value} />
          </div>
        )}

        <div className="grid-2col" style={{ gap: 16 }}>
          <div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: 8, fontWeight: 500 }}>編集</div>
            <textarea
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setPreview(e.target.value);
              }}
              style={{
                width: '100%',
                minHeight: '500px',
                boxSizing: 'border-box',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
              disabled={saving || rerunning}
              placeholder="Markdown形式で編集してください"
            />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: 8, fontWeight: 500 }}>プレビュー</div>
            <div
              className="card"
              style={{
                padding: 20,
                maxHeight: '600px',
                overflow: 'auto',
                minHeight: '500px',
              }}
            >
              <Markdown content={preview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

