import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface MarkdownPreviewProps {
  markdown: string;
}

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        components={{
          a: ({ children, ...props }) => (
            <a {...props} rel="noreferrer" target="_blank">
              {children}
            </a>
          ),
          code: ({ children, className, ...props }: CodeProps) => {
            const match = /language-(\w+)/.exec(className ?? '');
            const rawCode = String(children);
            const code = rawCode.replace(/\n$/, '');
            const isCodeBlock = Boolean(match) || rawCode.endsWith('\n');

            if (isCodeBlock) {
              return <CodeBlock code={code} language={match?.[1] ?? 'text'} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
