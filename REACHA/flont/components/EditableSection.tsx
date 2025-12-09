'use client';

import React, { useEffect, useState } from 'react';
import { apiPost, ResultsItem } from '../lib/api';
import DiffView from './DiffView';
import Markdown from './Markdown';

type Props = {
  company: string;
  item: ResultsItem;
  isRunning: boolean;
  onSaved: () => void;
  onRerun: (idx: number) => Promise<void>;
};

export default function EditableSection({ company, item, isRunning, onSaved, onRerun }: Props) {
  const [value, setValue] = useState(item.markdown || item.text || '');
  const [preview, setPreview] = useState(item.markdown || item.text || '');
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = item.markdown || item.text || '';
    setValue(v);
    setPreview(v);
  }, [item.index, item.markdown, item.text]);

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
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRerun() {
    setRerunning(true);
    setError(null);
    try {
      await onRerun(item.index);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setRerunning(false);
    }
  }

  function handleResetToOriginal() {
    const orig = item.originalMarkdown || item.originalText || '';
    setValue(orig);
    setPreview(orig);
  }

  const editedFlag = item.edited;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{item.title}</span>
          {editedFlag && <span className="pill pill-success">編集あり</span>}
          {!editedFlag && item.text && <span className="pill">未編集</span>}
          {item.historyCount ? <span className="pill pill-ghost">履歴 {item.historyCount}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleResetToOriginal} disabled={saving || rerunning || isRunning}>
            元に戻す
          </button>
          <button className="btn" onClick={handleRerun} disabled={saving || rerunning || isRunning}>
            {rerunning ? '再実行中…' : '再実行'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || rerunning}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      <div style={{ height: 8 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>編集</div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={12}
            style={{ width: '100%', resize: 'vertical' }}
            disabled={saving || rerunning}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>プレビュー</div>
          <div className="card" style={{ padding: 8, maxHeight: 280, overflow: 'auto' }}>
            <Markdown content={preview} />
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <DiffView original={item.originalMarkdown || item.originalText || ''} edited={value} />

      {error && (
        <div className="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

