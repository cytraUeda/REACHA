'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => <a {...props} />, // styled by globals.css
        h1: ({ node, ...props }) => <h2 {...props} />, // downscale for page flow
        h2: ({ node, ...props }) => <h3 {...props} />,
      }}
    >
      {content || ''}
    </ReactMarkdown>
  );
}


