'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          h1: ({ node, ...props }) => <h2 {...props} />,
          h2: ({ node, ...props }) => <h3 {...props} />,
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}


