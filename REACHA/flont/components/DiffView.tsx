'use client';

import React from 'react';
import Markdown from './Markdown';

type Props = {
  original?: string;
  edited?: string;
  titleLeft?: string;
  titleRight?: string;
};

export default function DiffView({ original, edited, titleLeft = '元の内容', titleRight = '現在の内容' }: Props) {
  return (
    <div className="grid-2col">
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{titleLeft}</div>
        <div style={{ maxHeight: '300px', overflow: 'auto', minHeight: '100px' }}>
          <Markdown content={original || ''} />
        </div>
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{titleRight}</div>
        <div style={{ maxHeight: '300px', overflow: 'auto', minHeight: '100px' }}>
          <Markdown content={edited || ''} />
        </div>
      </div>
    </div>
  );
}

